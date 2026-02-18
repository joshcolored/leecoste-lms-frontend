import {
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";
import { rtdb } from "../firebase";
import { ref as dbRef, onValue, set } from "firebase/database";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { remove } from "firebase/database";
import { db } from "../firebase";
import { useEffect, useState, useRef } from "react";
import { Send, ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";

/* ================= TYPES ================= */

interface AppUser {
    id: string;
    name: string;
    email: string;
    photo?: string;
}

interface Conversation {
    id: string;
    participants: string[];
    lastMessage?: string;
    lastSenderId?: string;
    updatedAt?: any;
    unread?: {
        [key: string]: number;
    };
}



interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: any;
}

/* ========================================= */

export default function Messages() {
    const auth = getAuth();
    const firebaseUser = auth.currentUser;
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<{ [key: string]: boolean }>({});
    const messagesContainerRef = useRef<HTMLDivElement | null>(null);
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [showNewChat, setShowNewChat] = useState(false);
    const [searchUser, setSearchUser] = useState("");
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const touchStartTime = useRef<number>(0);


    const activeConvData = conversations.find(
        (conv) => conv.id === activeConversation
    );

    const otherUserId = activeConvData?.participants.find(
        (id) => id !== currentUser?.id
    );

    const activeUser = users.find((u) => u.id === otherUserId);

    const filteredUsers = users.filter((user) => {
        const name = user.name?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const search = searchUser.toLowerCase();

        return name.includes(search) || email.includes(search);
    });


    useEffect(() => {
        if (!messagesContainerRef.current) return;

        messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
    }, [messages, activeConversation]);

    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        users.forEach((user) => {
            const statusRef = dbRef(rtdb, `status/${user.id}`);

            const unsubscribe = onValue(statusRef, (snapshot) => {
                const data = snapshot.val();

                setOnlineUsers((prev) => ({
                    ...prev,
                    [user.id]: data?.online || false,
                }));
            });

            unsubscribers.push(unsubscribe);
        });

        return () => {
            unsubscribers.forEach((unsub) => unsub());
        };
    }, [users]);



    useEffect(() => {
        if (!activeConversation || !currentUser) return;

        const typingRef = dbRef(rtdb, `typing/${activeConversation}`);

        const unsubscribe = onValue(typingRef, (snapshot) => {
            const data = snapshot.val();

            const someoneTyping = Object.keys(data).some(
                (uid) => uid !== currentUser.id && data[uid]
            );

            setIsTyping(someoneTyping);
        });

        return () => unsubscribe();
    }, [activeConversation, currentUser]);


    useEffect(() => {
        if (isTyping) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [isTyping]);

    /* ================= FETCH USER ================= */

    useEffect(() => {
        if (!firebaseUser) return;

        getDoc(doc(db, "users", firebaseUser.uid)).then((snap) => {
            if (snap.exists()) {
                setCurrentUser({ id: snap.id, ...snap.data() } as AppUser);
            }
        });
    }, [firebaseUser]);


    /* ================= LOAD USERS ================= */

    useEffect(() => {
        const storage = getStorage();

        const unsub = onSnapshot(collection(db, "users"), async (snap) => {
            const list: AppUser[] = await Promise.all(
                snap.docs.map(async (d) => {
                    const data = d.data();
                    let photoUrl = "";

                    try {
                        const avatarRef = storageRef(storage, `users/${d.id}/avatar.jpg`);
                        photoUrl = await getDownloadURL(avatarRef);
                    } catch (error) {
                        photoUrl = "";
                    }

                    return {
                        id: d.id,
                        name: data.name || "",
                        email: data.email || "",
                        photo: photoUrl,
                    } as AppUser;
                })
            );

            setUsers(list.filter((u) => u.id !== firebaseUser?.uid));
        });

        return () => unsub();
    }, []);


    /* ================= LOAD CONVERSATIONS ================= */

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", currentUser.id),
            orderBy("updatedAt", "desc")
        );


        const unsub = onSnapshot(q, (snap) => {
            const list: Conversation[] = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as Conversation[];

            setConversations(list);
        });

        return () => unsub();
    }, [currentUser]);

    /* ================= LOAD MESSAGES ================= */

    useEffect(() => {
        if (!activeConversation) {
            setMessages([]);
            setLoadingMessages(false); // ✅ prevent infinite loading
            return;
        }

        setLoadingMessages(true);

        const q = query(
            collection(db, "conversations", activeConversation, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const list: Message[] = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as Message[];

                setMessages(list);
                setLoadingMessages(false);
            },
            (error) => {
                console.error("Snapshot error:", error);
                setLoadingMessages(false); // ✅ prevent stuck loading on error
            }
        );

        return () => {
            unsub();
        };

    }, [activeConversation]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!currentUser) return null;

    /* ================= START CONVERSATION ================= */

    const startConversation = async (user: AppUser) => {
        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", currentUser.id)
        );

        const snap = await getDocs(q);

        const existing = snap.docs.find((d) =>
            d.data().participants.includes(user.id)
        );

        if (existing) {
            setActiveConversation(existing.id);

        } else {
            const newConv = await addDoc(collection(db, "conversations"), {
                participants: [currentUser.id, user.id],
                lastMessage: "",
                lastSenderId: "",
                updatedAt: serverTimestamp(),
                unread: {
                    [currentUser.id]: 0,
                    [user.id]: 0,
                },
            });
            setActiveConversation(newConv.id);
        }
    };

    /* ================= SEND ================= */

    const handleSend = async () => {
        if (!newMessage.trim() || !activeConversation) return;

        setIsSending(true);

        const messageData = {
            text: newMessage,
            senderId: currentUser.id,
            createdAt: serverTimestamp(),
        };
        try {
            await addDoc(
                collection(db, "conversations", activeConversation, "messages"),
                messageData
            );

            const convRef = doc(db, "conversations", activeConversation);
            const convSnap = await getDoc(convRef);
            const convData = convSnap.data();

            const otherId = convData?.participants.find(
                (p: string) => p !== currentUser.id
            );

            await updateDoc(convRef, {
                lastMessage: newMessage,
                lastSenderId: currentUser.id,
                updatedAt: serverTimestamp(),
                [`unread.${otherId}`]: (convData?.unread?.[otherId] || 0) + 1,
            });

            setNewMessage("");

            const typingRef = dbRef(
                rtdb,
                `typing/${activeConversation}/${currentUser.id}`
            );
            remove(typingRef);

        } finally {
            setIsSending(false);
        }
    };



    /* ================= SWIPE BACK ================= */

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartTime.current = Date.now();
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current) return;

        const diff = e.changedTouches[0].clientX - touchStartX.current;
        const time = Date.now() - touchStartTime.current;
        const velocity = diff / time;

        if (diff > 60 && velocity > 0.3) {
            setActiveConversation(null);
        }

        touchStartX.current = null;
    };


    /* ================= UI ================= */

    return (
        <div className="h-[calc(100vh-120px)] dark:bg-neutral-900 rounded-xl border border-neutral-300 dark:border-neutral-600 overflow-hidden">

            {showNewChat && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center md:justify-center">

                    {/* Overlay click */}
                    <div
                        className="absolute inset-0"
                        onClick={() => {
                            setShowNewChat(false);
                            setSearchUser("");
                        }}
                    />

                    {/* Modal */}
                    <div className="relative bg-neutral-900 w-full md:w-[420px] max-h-[80%] rounded-t-2xl md:rounded-xl border border-neutral-800 shadow-xl flex flex-col">

                        {/* Header */}
                        <div className="p-5 border-b border-neutral-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-semibold text-lg">
                                    New Conversation
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowNewChat(false);
                                        setSearchUser("");
                                    }}
                                    className="text-neutral-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Search Input */}
                            <input
                                type="text"
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                placeholder="Search name or email..."
                                className="w-full bg-neutral-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>

                        {/* User List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredUsers.length === 0 && (
                                <p className="text-neutral-500 text-sm text-center py-6">
                                    No users found
                                </p>
                            )}

                            {filteredUsers.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => {
                                        startConversation(user);
                                        setShowNewChat(false);
                                        setSearchUser("");
                                    }}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-800 cursor-pointer transition"
                                >
                                    <img
                                        src={
                                            user.photo
                                                ? user.photo
                                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`
                                        }
                                        alt={user.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />


                                    <div>
                                        <p className="text-white text-sm font-medium">
                                            {user.name}
                                        </p>
                                        <p className="text-neutral-400 text-xs">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            )}


            {/* DESKTOP */}
            <div className="hidden md:flex h-full">

                {/* Sidebar */}
                <div className="w-80 border-r dark:border-neutral-600 border-neutral-300 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-neutral-300 dark:bg-neutral-900 dark:border-neutral-600">
                        <h2 className="dark:text-neutral-100 font-semibold">Chats</h2>
                        <button
                            onClick={() => setShowNewChat(true)}
                            style={{ backgroundColor: "var(--brand-color)" }}
                            className="bg-indigo-600 p-2 rounded-full hover:bg-indigo-500"
                        >
                            <Plus className="text-white" size={16} />
                        </button>

                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.map((conv) => {
                            const otherId = conv.participants.find(
                                (p) => p !== currentUser.id
                            );
                            const isActive = activeConversation === conv.id;
                            const otherUser = users.find((u) => u.id === otherId);
                            const unreadCount = conv.unread?.[currentUser.id] ?? 0;
                            const isUnread = unreadCount > 0;
                            if (!otherUser) return null;

                            return (
                                <div
                                    key={conv.id}
                                    onClick={async () => {
                                        if (activeConversation === conv.id) return;
                                        setActiveConversation(conv.id);

                                        await updateDoc(doc(db, "conversations", conv.id), {
                                            [`unread.${currentUser.id}`]: 0,
                                        });
                                    }}
                                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors
                                        ${isActive
                                            ? "border-l-2 border-[var(--brand-color)]"
                                            : "hover:bg-[var(--brand-color)]/10 dark:hover:bg-[var(--brand-color)]/20"
                                        }`}

                                >
                                    {/* LEFT SIDE */}
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={otherUser.photo || "https://i.pravatar.cc/150"}
                                            className="w-10 h-10 rounded-full"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <p className={`text-sm ${isUnread ? "font-semibold text-white" : "text-neutral-800 dark:text-white"}`}>
                                                    {otherUser.name}
                                                </p>
                                                <span
                                                    className={`w-2 h-2 rounded-full ${onlineUsers[otherUser.id] ? "bg-green-500" : "bg-neutral-500"
                                                        }`}
                                                />
                                                <span className="text-neutral-400">
                                                    {onlineUsers[otherUser.id] ? "Online" : "Offline"}
                                                </span>
                                            </div>
                                            <p
                                                className={`text-xs truncate ${isUnread ? "font-semibold text-white" : "text-neutral-500"
                                                    }`}
                                            >
                                                {conv.lastMessage || "Start conversation"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 🔥 UNREAD BADGE */}
                                    {unreadCount > 0 && (
                                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full min-w-[25px] text-center font-medium">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}

                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chat */}
                <div className="flex-1 flex flex-col">
                    {activeConversation ? (
                        <>
                            {/* 🔥 CHAT HEADER */}
                            <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-300 dark:bg-neutral-900 dark:border-neutral-600 sticky top-0 z-10">
                                <img
                                    src={
                                        activeUser?.photo
                                            ? activeUser.photo
                                            : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                activeUser?.name || "User"
                                            )}`
                                    }
                                    alt={activeUser?.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />

                                <div>
                                    <p className="text-neutral-800 dark:text-white font-semibold text-sm">
                                        {activeUser?.name || "User"}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span
                                            className={`w-2 h-2 rounded-full ${activeUser && onlineUsers[activeUser.id] ? "bg-green-500" : "bg-neutral-500"
                                                }`}
                                        />
                                        <span className="text-neutral-500 dark:text-neutral-400">
                                            {activeUser && onlineUsers[activeUser.id] ? "Online" : "Offline"}
                                        </span>
                                        <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-2 text-xs">
                                            {activeUser?.email}
                                        </p>
                                    </div>

                                </div>
                            </div>

                            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center h-full text-neutral-400">
                                        Loading conversation...
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((msg) => {
                                            const isMe = msg.senderId === currentUser.id;

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        style={isMe ? { backgroundColor: "var(--brand-color)" } : undefined}
                                                        className={`px-4 py-2 rounded-2xl text-sm ${isMe
                                                            ? "text-white"
                                                            : "bg-neutral-300 text-neutral-900"
                                                            }`}
                                                    >
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* 🔥 Sending indicator */}
                                        {isSending && (
                                            <div className="flex justify-end">
                                                <div className=" rounded-2xl text-neutral-400 mt-[-10px] text-[8px] animate-pulse">
                                                    Sending...
                                                </div>
                                            </div>
                                        )}


                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>

                            {/* Typing indicator */}
                            {isTyping && (
                                <div className="px-6 py-2 text-sm text-neutral-400 animate-pulse">
                                    {activeUser?.name} is typing...
                                </div>
                            )}

                            <div className="border-t border-neutral-300 dark:border-neutral-800 p-4 flex gap-3">
                                <input
                                    value={newMessage}
                                    onBlur={() => {
                                        if (!activeConversation) return;

                                        const typingRef = dbRef(
                                            rtdb,
                                            `typing/${activeConversation}/${currentUser.id}`
                                        );

                                        remove(typingRef);
                                    }}
                                    onChange={(e) => {
                                        setNewMessage(e.target.value);

                                        if (!activeConversation || !currentUser) return;

                                        const typingRef = dbRef(
                                            rtdb,
                                            `typing/${activeConversation}/${currentUser.id}`
                                        );

                                        set(typingRef, true);

                                        if (typingTimeoutRef.current) {
                                            clearTimeout(typingTimeoutRef.current);
                                        }

                                        typingTimeoutRef.current = setTimeout(() => {
                                            remove(typingRef);
                                        }, 2000);
                                    }}



                                    className="flex-1 bg-neutral-300 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-2 rounded-full outline-none"
                                    placeholder="Type a message..."
                                />
                                <button
                                    onClick={handleSend}
                                    style={{ backgroundColor: "var(--brand-color)" }}
                                    disabled={!newMessage.trim()}
                                    className="bg-indigo-600 p-4 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    <Send className="text-gray-300" size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center flex-1 text-neutral-500">
                            Select a conversation
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE */}
        <div className="md:hidden min-h-dvh relative overflow-hidden border-neutral-700 ">
                <motion.div
                    className="flex h-dvh w-full"
                    animate={{ x: activeConversation ? "-100%" : "0%" }}
                    transition={{
                        type: "tween",
                        duration: 0.28,
                        ease: [0.4, 0, 0.2, 1]
                    }}
                >
                    {/* Sidebar */}
                    <div className="w-full flex-shrink-0 border-r dark:border-neutral-800 border-neutral-300 flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-400 dark:border-neutral-600">
                            <h2 className="dark:text-white text-neutral-900 font-semibold">Chats</h2>
                            <button
                                onClick={() => setShowNewChat(true)}
                                style={{ backgroundColor: "var(--brand-color)" }}
                                className="p-2 rounded-full hover:bg-indigo-500"
                            >
                                <Plus className="text-white" size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {conversations.map((conv) => {
                                const otherId = conv.participants.find(
                                    (p) => p !== currentUser.id
                                );
                                const otherUser = users.find((u) => u.id === otherId);
                                const unreadCount = conv.unread?.[currentUser.id] ?? 0;
                                const isUnread = unreadCount > 0;
                                if (!otherUser) return null;

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={async () => {
                                            if (activeConversation === conv.id) return;
                                            setActiveConversation(conv.id);

                                            await updateDoc(doc(db, "conversations", conv.id), {
                                                [`unread.${currentUser.id}`]: 0,
                                            });
                                        }}
                                        className="flex items-center justify-between p-4 hover:bg-neutral-300 dark:hover:bg-neutral-700  cursor-pointer"
                                    >
                                        {/* LEFT SIDE */}
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={otherUser.photo || "https://i.pravatar.cc/150"}
                                                className="w-10 h-10 rounded-full"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <p className={`text-sm ${isUnread ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-900 dark:text-neutral-300"}`}>
                                                        {otherUser.name}
                                                    </p>
                                                    <span
                                                        className={`w-2 h-2 rounded-full ${onlineUsers[otherUser.id] ? "bg-green-500" : "bg-neutral-500"
                                                            }`}
                                                    />
                                                    <span className="text-neutral-400">
                                                        {onlineUsers[otherUser.id] ? "Online" : "Offline"}
                                                    </span>
                                                </div>

                                                <p
                                                    className={`text-xs truncate ${isUnread ? "font-semibold text-neutral-600 dark:text-white" : "text-neutral-600 dark:text-neutral-500"
                                                        }`}
                                                >
                                                    {conv.lastMessage || "Start conversation"}
                                                </p>

                                            </div>
                                        </div>

                                        {/* 🔥 UNREAD BADGE */}
                                        {unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[22px] text-center font-medium">
                                                {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                        )}

                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat */}
                    <div
                        className="w-full flex-shrink-0 flex flex-col"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        {activeConversation && (
                            <>
                                <div className="flex items-center gap-3 p-4 border-b dark:border-neutral-800 border-neutral-300 ">
                                    <ArrowLeft
                                        size={18}
                                        className="dark:text-gray-300 cursor-pointer hover:text-white transition text-neutral-800"
                                        onClick={() => setActiveConversation(null)}
                                    />
                                    <img
                                        src={
                                            activeUser?.photo
                                                ? activeUser.photo
                                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    activeUser?.name || "User"
                                                )}`
                                        }
                                        alt={activeUser?.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                    />

                                    <div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <p className="dark:text-white text-neutral-600 font-semibold text-sm">
                                                {activeUser?.name || "User"}
                                            </p>
                                            <span
                                                className={`w-2 h-2 rounded-full ${activeUser && onlineUsers[activeUser.id] ? "bg-green-500" : "bg-neutral-500"
                                                    }`}
                                            />
                                            <span className="text-neutral-400">
                                                {activeUser && onlineUsers[activeUser.id] ? "Online" : "Offline"}
                                            </span>
                                        </div>
                                        <p className="text-neutral-400 flex items-center gap-2 text-xs">
                                            {activeUser?.email}
                                        </p>
                                    </div>
                                </div>

                                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {loadingMessages ? (
                                        <div className="flex items-center justify-center h-full text-neutral-400">
                                            Loading conversation...
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((msg) => {
                                                const isMe = msg.senderId === currentUser.id;

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div
                                                            style={isMe ? { backgroundColor: "var(--brand-color)" } : undefined}
                                                            className={`px-4 py-2 rounded-2xl text-sm ${isMe
                                                                ? "text-white"
                                                                : "bg-neutral-300 text-neutral-900"
                                                                }`}
                                                        >
                                                            {msg.text}

                                                        </div>
                                                    </div>
                                                );
                                            })}


                                            {/* 🔥 Sending indicator */}
                                            {isSending && (
                                                <div className="flex justify-end">
                                                    <div className=" rounded-2xl text-neutral-400 mt-[-10px] text-[8px] animate-pulse">
                                                        Sending...
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={bottomRef} />
                                        </>
                                    )}
                                </div>

                                {/* Typing indicator */}
                                {isTyping && (
                                    <div className="px-6 py-2 text-sm text-neutral-400 animate-pulse">
                                        {activeUser?.name} is typing...
                                    </div>
                                )}

                                <div className="border-t border-neutral-300 dark:border-neutral-800 p-4 flex gap-3">
                                    <input
                                        value={newMessage}
                                        onBlur={() => {
                                            if (!activeConversation) return;

                                            const typingRef = dbRef(
                                                rtdb,
                                                `typing/${activeConversation}/${currentUser.id}`
                                            );

                                            remove(typingRef);
                                        }}
                                        onChange={(e) => {
                                            setNewMessage(e.target.value);

                                            if (!activeConversation || !currentUser) return;

                                            const typingRef = dbRef(
                                                rtdb,
                                                `typing/${activeConversation}/${currentUser.id}`
                                            );

                                            set(typingRef, true);

                                            if (typingTimeoutRef.current) {
                                                clearTimeout(typingTimeoutRef.current);
                                            }

                                            typingTimeoutRef.current = setTimeout(() => {
                                                remove(typingRef);
                                            }, 2000);
                                        }}



                                        className="flex-1 bg-neutral-300 dark:bg-neutral-800 dark:text-white text-neutral-700 px-4 py-2 rounded-full outline-none"
                                        placeholder="Type a message..."
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!newMessage.trim()}
                                        style={{ backgroundColor: "var(--brand-color)" }}
                                        className="bg-indigo-600 p-4 rounded-full hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="text-gray-300" size={16} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
