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
    deleteDoc,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";
import { rtdb } from "../firebase";
import { ref as dbRef, onValue, set } from "firebase/database";
import { getStorage, ref as storageRef, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { remove } from "firebase/database";
import { db } from "../firebase";
import { useEffect, useState, useRef } from "react";
import { Send, ArrowLeft, Plus, Trash2, X, Smile, Reply, Trash, Upload, File as FileIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MessagesSkeleton from "../skeletons/MessagesSkeleton";

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
    lastMessageType?: "text" | "image" | "file" | "video" | "reaction";
    lastSenderId?: string;
    updatedAt?: any;
    unread?: {
        [key: string]: number;
    };
}



interface Message {
    id: string;
    type: "text" | "image" | "file";
    text?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    senderId: string;
    createdAt: any;

    reactions?: {
        [emoji: string]: string[]; // array of userIds
    };
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
    const [initialLoading, setInitialLoading] = useState(true);
    const [isConvDeleteMode, setIsConvDeleteMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedConvs, setSelectedConvs] = useState<string[]>([]);
    const [isMsgDeleteMode, setIsMsgDeleteMode] = useState(false);
    const [selectedMsgs, setSelectedMsgs] = useState<string[]>([]);
    const [showMsgDeleteModal, setShowMsgDeleteModal] = useState(false);
    const [deletingMsgs, setDeletingMsgs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [activeActionMsg, setActiveActionMsg] = useState<string | null>(null);
    const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);




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

    useEffect(() => {
        if (!firebaseUser) return;

        const init = async () => {
            const snap = await getDoc(doc(db, "users", firebaseUser.uid));
            if (snap.exists()) {
                setCurrentUser({ id: snap.id, ...snap.data() } as AppUser);
            }
            setInitialLoading(false);
        };

        init();
    }, [firebaseUser]);

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
            setLoadingMessages(false);
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
                setLoadingMessages(false);
            }
        );

        return () => {
            unsub();
        };

    }, [activeConversation]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (initialLoading || !currentUser) {
        return <MessagesSkeleton />;
    }

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
        if (!activeConversation || !currentUser) return;
        if (!newMessage.trim() && selectedFiles.length === 0) return;

        setIsSending(true);

        try {
            const convRef = doc(db, "conversations", activeConversation);
            const convSnap = await getDoc(convRef);
            const convData = convSnap.data();

            const otherId = convData?.participants.find(
                (p: string) => p !== currentUser.id
            );

            let lastMessage = "";
            let lastMessageType: "text" | "image" | "file" | "video" = "text";

            // =========================
            // 🔥 HANDLE FILES FIRST
            // =========================

            for (const file of selectedFiles) {
                const fileId = doc(collection(db, "tmp")).id;

                const filePath = `conversations/${activeConversation}/${fileId}`;
                const fileRef = storageRef(getStorage(), filePath);

                const uploadTask = uploadBytesResumable(fileRef, file);

                const downloadURL = await new Promise<string>((resolve, reject) => {
                    uploadTask.on(
                        "state_changed",
                        (snapshot) => {
                            const progress =
                                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(Math.round(progress));
                        },
                        reject,
                        async () => {
                            const url = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(url);
                        }
                    );
                });

                // determine file type
                let messageType: "image" | "file" | "video" = "file";

                if (file.type.startsWith("image/")) {
                    messageType = "image";
                } else if (file.type.startsWith("video/")) {
                    messageType = "video";
                }

                await addDoc(
                    collection(db, "conversations", activeConversation, "messages"),
                    {
                        type: messageType,
                        fileUrl: downloadURL,
                        filePath,
                        fileType: file.type,
                        senderId: currentUser.id,
                        createdAt: serverTimestamp(),
                    }
                );

                // set preview for sidebar (last file wins)
                lastMessageType = messageType;
                lastMessage = "";
            }

            setUploadProgress(null);

            // =========================
            // 🔥 HANDLE TEXT MESSAGE
            // =========================

            if (newMessage.trim()) {
                await addDoc(
                    collection(db, "conversations", activeConversation, "messages"),
                    {
                        type: "text",
                        text: newMessage,
                        senderId: currentUser.id,
                        createdAt: serverTimestamp(),
                    }
                );

                lastMessage = newMessage;
                lastMessageType = "text";
            }

            // =========================
            // 🔥 UPDATE CONVERSATION META
            // =========================

            await updateDoc(convRef, {
                lastMessage,
                lastMessageType,
                lastSenderId: currentUser.id,
                updatedAt: serverTimestamp(),
                ...(otherId && {
                    [`unread.${otherId}`]:
                        (convData?.unread?.[otherId] || 0) + 1,
                }),
            });

            // =========================
            // 🔥 CLEAN UP UI
            // =========================

            setSelectedFiles([]);
            setNewMessage("");

        } catch (err) {
            console.error("Send error:", err);
        } finally {
            setIsSending(false);
        }
    };




    const deleteSelectedConversations = async () => {
        for (const convId of selectedConvs) {

            const messagesSnap = await getDocs(
                collection(db, "conversations", convId, "messages")
            );

            for (const msgDoc of messagesSnap.docs) {
                const msgData = msgDoc.data();

                // 🔥 Delete file from storage if exists
                if (msgData?.filePath) {
                    try {
                        const storage = getStorage();
                        const fileRef = storageRef(storage, msgData.filePath);
                        await deleteObject(fileRef);
                        console.log("File deleted from storage");
                    } catch (err) {
                        console.error("Storage delete failed:", err);
                    }
                }

                await deleteDoc(msgDoc.ref);
            }

            // 🔥 Delete conversation doc
            await deleteDoc(doc(db, "conversations", convId));
        }

        setSelectedConvs([]);
        setIsConvDeleteMode(false);

        if (selectedConvs.includes(activeConversation || "")) {
            setActiveConversation(null);
        }
    };

    const deleteSelectedMessages = async () => {
        if (!activeConversation) return;

        setDeletingMsgs(selectedMsgs);

        setTimeout(async () => {
            for (const msgId of selectedMsgs) {
                const msgRef = doc(
                    db,
                    "conversations",
                    activeConversation,
                    "messages",
                    msgId
                );

                const msgSnap = await getDoc(msgRef);
                const msgData = msgSnap.data();

                // 🔥 DELETE STORAGE USING filePath
                if (msgData?.filePath) {
                    try {
                        const storage = getStorage();
                        const fileRef = storageRef(storage, msgData.filePath);
                        await deleteObject(fileRef);
                        console.log("File deleted from storage");
                    } catch (err) {
                        console.error("Storage delete failed:", err);
                    }
                }

                await deleteDoc(msgRef);
            }

            setDeletingMsgs([]);
            setSelectedMsgs([]);
            setIsMsgDeleteMode(false);
        }, 300);
    };



    const toggleReaction = async (msg: Message, emoji: string) => {
        if (!activeConversation || !currentUser) return;

        const convRef = doc(db, "conversations", activeConversation);
        const msgRef = doc(
            db,
            "conversations",
            activeConversation,
            "messages",
            msg.id
        );

        try {
            await runTransaction(db, async (transaction) => {

                const msgSnap = await transaction.get(msgRef);
                const convSnap = await transaction.get(convRef);

                if (!msgSnap.exists() || !convSnap.exists()) return;

                const msgData = msgSnap.data();
                const convData = convSnap.data();

                const reactions = msgData.reactions || {};
                const updatedReactions: any = { ...reactions };

                // 🔥 Remove current user from ALL emojis first (replace behavior)
                Object.keys(updatedReactions).forEach((key) => {
                    updatedReactions[key] = updatedReactions[key].filter(
                        (uid: string) => uid !== currentUser.id
                    );

                    // Clean empty arrays
                    if (updatedReactions[key].length === 0) {
                        delete updatedReactions[key];
                    }
                });

                const alreadyReacted = reactions[emoji]?.includes(currentUser.id);

                // If user did NOT already react → add reaction
                if (!alreadyReacted) {
                    updatedReactions[emoji] = [
                        ...(updatedReactions[emoji] || []),
                        currentUser.id,
                    ];
                }

                // ✅ Update message reactions atomically
                transaction.update(msgRef, {
                    reactions: updatedReactions,
                });

                // 🔥 Determine ownership
                const reactingToOwnMessage = msg.senderId === currentUser.id;

                const otherUserId = convData.participants?.find(
                    (id: string) => id !== currentUser.id
                );

                if (!otherUserId) return;

                // ------------------------------------------------
                // 🔥 ONLY increment unread if:
                // - reacting to OTHER user's message
                // - AND it is a NEW reaction (not removing)
                // ------------------------------------------------
                if (!reactingToOwnMessage && !alreadyReacted) {


                    const currentUnread =
                        convData.unread?.[otherUserId] || 0;

                    let lastMessageReact = convData.lastMessage;
                    let lastMessageType = convData.lastMessageType;

                    // 🔥 Only change to reaction message if reacting to OTHER user
                    if (!reactingToOwnMessage && !alreadyReacted) {
                        lastMessageReact = `Reacted ${emoji} to your message`;
                        lastMessageType = reactions;
                    }

                    transaction.update(convRef, {
                        lastMessage: lastMessageReact,
                        lastMessageType: lastMessageType, // ✅ preserved or changed properly
                        lastSenderId: currentUser.id,
                        updatedAt: serverTimestamp(),
                        [`unread.${otherUserId}`]:
                            !reactingToOwnMessage && !alreadyReacted
                                ? currentUnread + 1
                                : currentUnread,
                    });
                } else {

                    // Just update timestamp (no unread increment)
                    transaction.update(convRef, {
                        updatedAt: serverTimestamp(),
                    });
                }

            });

        } catch (error) {
            console.error("Reaction transaction failed:", error);
        }
    };




    /* ================= UI ================= */

    return (

        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
            >
                <div className="h-[calc(100vh-120px)] shadow dark:bg-neutral-800 rounded-xl border border-neutral-300 dark:border-neutral-800 overflow-hidden">
                    <AnimatePresence>
                        {showNewChat && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center md:justify-center">

                                {/* Overlay click */}
                                <div
                                    className="absolute inset-0"
                                    onClick={() => {
                                        setShowNewChat(false);
                                        setSearchUser("");
                                    }}
                                />

                                {/* Modal */}
                                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="relative bg-neutral-200 dark:bg-neutral-900 w-full md:w-[420px] max-h-[80%] rounded-t-2xl md:rounded-xl border dark:border-neutral-800 shadow-xl flex flex-col">

                                    {/* Header */}
                                    <div className="p-5 border-b border-neutral-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="dark:text-white text-neutral-800 font-semibold text-lg">
                                                New Conversation
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setShowNewChat(false);
                                                    setSearchUser("");
                                                }}
                                                className="text-neutral-800 dark:text-neutral-500 hover:text-white"
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
                                            className="w-full dark:bg-neutral-800 bg-neutral-300 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-[var(--brand-color)]"
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
                                                    <p className="dark:text-white text-neutral-800 text-sm font-medium">
                                                        {user.name}
                                                    </p>
                                                    <p className="dark:text-neutral-400 text-neutral-600 text-xs">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {showMsgDeleteModal && (
                            <motion.div
                                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="bg-white dark:bg-neutral-900 p-6 rounded-xl w-[90%] max-w-md"
                                >
                                    <h3 className="text-lg font-semibold mb-3 text-neutral-800 dark:text-white">
                                        Delete Messages
                                    </h3>

                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                                        Do you want to delete the selected messages?
                                        This action cannot be undone.
                                    </p>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowMsgDeleteModal(false)}
                                            className="px-4 py-2 rounded-lg bg-neutral-200 dark:text-neutral-300  dark:bg-neutral-700 text-sm"
                                        >
                                            No
                                        </button>

                                        <button
                                            onClick={async () => {
                                                await deleteSelectedMessages();
                                                setShowMsgDeleteModal(false);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
                                        >
                                            Yes
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>


                    <AnimatePresence>
                        {showDeleteModal && (
                            <motion.div
                                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="bg-white dark:bg-neutral-900 p-6 rounded-xl w-[90%] max-w-md"
                                >
                                    <h3 className="text-lg font-semibold mb-3 text-neutral-800 dark:text-white">
                                        Delete Conversation
                                    </h3>

                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                                        Do you want to delete this conversation?
                                        There's no going back after doing this action.
                                    </p>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowDeleteModal(false)}
                                            className="px-4 py-2 rounded-lg bg-neutral-200 dark:text-neutral-300 dark:bg-neutral-700 text-sm"
                                        >
                                            No
                                        </button>

                                        <button
                                            onClick={async () => {
                                                await deleteSelectedConversations();
                                                setShowDeleteModal(false);
                                            }}
                                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
                                        >
                                            Yes
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* DESKTOP */}
                    <div className="hidden md:flex h-full">

                        {/* Sidebar */}
                        <div className="w-80 border-r dark:border-neutral-600 border-neutral-300 flex flex-col">
                            <div className="flex items-center justify-between pl-4 pr-2  py-[19.5px] border-b border-neutral-300 dark:bg-neutral-800 dark:border-neutral-600">
                                <h2 className="dark:text-neutral-100 text-[22px] font-semibold">Messages</h2>
                                <div className="flex items-center gap-2">


                                    <button
                                        onClick={() => setShowNewChat(true)}
                                        style={{ backgroundColor: "var(--brand-color)" }}
                                        className="p-2 rounded-full"
                                    >
                                        <Plus className="text-white" size={17} />
                                    </button>



                                    {isConvDeleteMode && selectedConvs.length > 0 && (
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className="pl-[10px] pr-[5px]"
                                        >
                                            <Trash2 className="text-red-500" size={18} />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (isConvDeleteMode) {
                                                // Cancel delete mode
                                                setIsConvDeleteMode(false);
                                                setSelectedConvs([]);
                                            } else {
                                                setIsConvDeleteMode(true);
                                            }
                                        }}
                                        className="px-[10px] transition"
                                    >
                                        {isConvDeleteMode ? (
                                            <X className="dark:text-white" size={18} />
                                        ) : (
                                            <Trash2 className="dark:text-white" size={18} />
                                        )}
                                    </button>
                                </div>

                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
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

                                            const isReaction = conv.lastMessageType === "reaction";

                                            let previewText = "Start conversation";

                                            // 🔥 PRIORITY 1 — Reaction (overrides unread)
                                            if (isReaction && conv.lastMessage) {
                                                previewText = conv.lastMessage;
                                            }

                                            // 🔥 PRIORITY 2 — Multiple unread
                                            else if (unreadCount > 1) {
                                                previewText =
                                                    unreadCount > 9
                                                        ? "9+ new messages"
                                                        : `${unreadCount} new messages`;
                                            }

                                            // 🔥 PRIORITY 3 — Media
                                            else if (conv.lastMessageType === "image") {
                                                previewText =
                                                    conv.lastSenderId === currentUser.id
                                                        ? "You sent a photo"
                                                        : `${otherUser.name} sent a photo`;
                                            }

                                            else if (conv.lastMessageType === "video") {
                                                previewText =
                                                    conv.lastSenderId === currentUser.id
                                                        ? "You sent a video"
                                                        : `${otherUser.name} sent a video`;
                                            }

                                            else if (conv.lastMessageType === "file") {
                                                previewText =
                                                    conv.lastSenderId === currentUser.id
                                                        ? "You sent a file"
                                                        : `${otherUser.name} sent a file`;
                                            }

                                            else if (conv.lastMessage) {
                                                previewText = isReaction
                                                    ? conv.lastMessage
                                                    : conv.lastSenderId === currentUser.id
                                                        ? `You: ${conv.lastMessage}`
                                                        : conv.lastMessage;
                                            }
                                            return (
                                                <div key={conv.id} className="flex items-center">
                                                    <div
                                                        onClick={async () => {
                                                            if (isConvDeleteMode) return;
                                                            if (activeConversation === conv.id) return;

                                                            setActiveConversation(conv.id);

                                                            await updateDoc(doc(db, "conversations", conv.id), {
                                                                [`unread.${currentUser.id}`]: 0,
                                                            });
                                                        }}
                                                        className={`flex items-center justify-between p-4 cursor-pointer transition-all duration-200 w-full
                ${isActive
                                                                ? "dark:bg-neutral-800 hover:bg-neutral-300 border-l-4 rounded border-[var(--brand-color)]"
                                                                : "hover:bg-neutral-300 dark:hover:bg-neutral-600"
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 w-full">
                                                            <div className="relative">
                                                                <img
                                                                    src={otherUser.photo || "https://i.pravatar.cc/150"}
                                                                    className="w-10 h-10 rounded-full"
                                                                />
                                                                <span
                                                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white 
                      ${onlineUsers[otherUser.id] ? "bg-green-500" : "hidden"}`}
                                                                />
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <p
                                                                    className={`text-sm ${isActive
                                                                        ? "font-semibold text-[var(--brand-color)]"
                                                                        : isUnread && !isReaction
                                                                            ? "font-semibold text-neutral-900 dark:text-white"
                                                                            : "text-neutral-800 dark:text-white"
                                                                        }`}
                                                                >
                                                                    {otherUser.name}
                                                                </p>

                                                                <p
                                                                    className={`text-xs truncate ${isUnread && !isReaction
                                                                        ? "font-semibold dark:text-white"
                                                                        : "text-neutral-500"
                                                                        }`}
                                                                >
                                                                    {previewText}

                                                                    {conv.updatedAt?.toDate && (
                                                                        <> • {conv.updatedAt.toDate().toLocaleTimeString([], {
                                                                            hour: "2-digit",
                                                                            minute: "2-digit",
                                                                        })}</>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {isConvDeleteMode && (
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedConvs.includes(conv.id)}
                                                                onChange={() => {
                                                                    setSelectedConvs((prev) =>
                                                                        prev.includes(conv.id)
                                                                            ? prev.filter((id) => id !== conv.id)
                                                                            : [...prev, conv.id]
                                                                    );
                                                                }}
                                                                className="ml-4"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                        </div>

                        {/* Chat */}
                        <div className="flex-1 flex flex-col">
                            {activeConversation ? (
                                <>
                                    {/* 🔥 CHAT HEADER */}
                                    <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-300 dark:bg-neutral-800 dark:border-neutral-600 sticky top-0 z-10">
                                        <div className="relative">
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

                                            {/* Status dot */}
                                            <span
                                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white 
                                                        ${activeUser && onlineUsers[activeUser.id]
                                                        ? "bg-green-500"
                                                        : "bg-neutral-400"
                                                    }`}
                                            />
                                        </div>

                                        <div>
                                            <p className="text-neutral-800 dark:text-white font-semibold text-md">
                                                {activeUser?.name || "User"}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-neutral-500 dark:text-neutral-400">
                                                    {activeUser && onlineUsers[activeUser.id] ? "Online" : "Offline"}
                                                </span>
                                                <span className="text-neutral-500 dark:text-neutral-400">
                                                    •
                                                </span>
                                                <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-2 text-xs">
                                                    {activeUser?.email}
                                                </p>
                                            </div>

                                        </div>

                                        <div className="ml-auto flex items-center gap-2">

                                            {/* Toggle delete mode */}
                                            <button
                                                onClick={() => {
                                                    if (isMsgDeleteMode) {
                                                        setIsMsgDeleteMode(false);
                                                        setSelectedMsgs([]);
                                                    } else {
                                                        setIsMsgDeleteMode(true);
                                                    }
                                                }}
                                                className="p-2 transition"
                                            >
                                                {isMsgDeleteMode ? (
                                                    <X className="dark:text-white" size={22} />
                                                ) : (
                                                    <Trash2 className="dark:text-white" size={22} />
                                                )}
                                            </button>

                                            {/* Red delete when messages selected */}
                                            {isMsgDeleteMode && selectedMsgs.length > 0 && (
                                                <button
                                                    onClick={() => setShowMsgDeleteModal(true)}
                                                    className="p-2"
                                                >
                                                    <Trash2 className="text-red-500" size={22} />
                                                </button>
                                            )}

                                        </div>

                                    </div>

                                    <div ref={messagesContainerRef} onClick={() => {
                                        setActiveActionMsg(null);
                                        setActiveReactionPicker(null);
                                    }} className="flex-1 overflow-y-auto p-6 pt-12 space-y-4">
                                        {loadingMessages ? (
                                            <div className="flex items-center justify-center h-full text-neutral-400">
                                                Loading conversation...
                                            </div>
                                        ) : (
                                            <>
                                                {messages.map((msg) => {
                                                    const isMe = msg.senderId === currentUser.id;

                                                    return (
                                                        <motion.div
                                                            key={msg.id}
                                                            initial={{ opacity: 0, y: 5 }}
                                                            animate={{
                                                                opacity: deletingMsgs.includes(msg.id) ? 0 : 1,
                                                                y: deletingMsgs.includes(msg.id) ? -10 : 0,
                                                                scale: deletingMsgs.includes(msg.id) ? 0.95 : 1,
                                                            }}
                                                            transition={{ duration: 0.3 }}
                                                            className={`flex items-end gap-2 group ${isMe ? "justify-end" : "justify-start"}`}
                                                        >
                                                            {isMsgDeleteMode && msg.senderId === currentUser.id && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedMsgs.includes(msg.id)}
                                                                    onChange={() => {
                                                                        setSelectedMsgs((prev) =>
                                                                            prev.includes(msg.id)
                                                                                ? prev.filter((id) => id !== msg.id)
                                                                                : [...prev, msg.id]
                                                                        );
                                                                    }}
                                                                    className="mr-2"
                                                                />
                                                            )}

                                                            {/* Wrapper */}
                                                            <div
                                                                className="relative group max-w-[75%]"

                                                            >
                                                                <div className="flex relative">
                                                                    {/* 💬 Bubble */}
                                                                    <div
                                                                        style={
                                                                            isMe && msg.type !== "image"
                                                                                ? { backgroundColor: "var(--brand-color)" }
                                                                                : undefined
                                                                        }
                                                                        className={`rounded-2xl break-words whitespace-pre-wrap overflow-hidden ${msg.type === "image"
                                                                            ? "p-1"
                                                                            : `px-4 py-2 text-sm ${isMe
                                                                                ? "text-white"
                                                                                : "bg-neutral-300 text-neutral-900"
                                                                            }`
                                                                            }`}

                                                                        onClick={() => {
                                                                            // Mobile toggle
                                                                            if (window.innerWidth < 768) {
                                                                                setActiveActionMsg(activeActionMsg === msg.id ? null : msg.id);
                                                                            }
                                                                        }}

                                                                    >
                                                                        {(!msg.type || msg.type === "text") && msg.text}

                                                                        {msg.type === "image" && (
                                                                            <img
                                                                                src={msg.fileUrl}
                                                                                className="max-w-[260px] max-h-[300px] rounded-xl object-cover"
                                                                            />
                                                                        )}

                                                                        {msg.type === "file" && (
                                                                            <a
                                                                                href={msg.fileUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center gap-2"
                                                                            >
                                                                                <FileIcon size={18} />
                                                                                <span className="underline">{msg.fileName}</span>
                                                                            </a>
                                                                        )}
                                                                        {msg.reactions &&
                                                                            Object.entries(msg.reactions).some(
                                                                                ([_, users]) => users.length > 0
                                                                            ) && (
                                                                                <div
                                                                                    className={`
            absolute -bottom-3 
            ${isMe ? "left-[95px]  translate-x-1/2" : "right-[70px] -translate-x-1/6"}
            flex items-center gap-1
            bg-white dark:bg-neutral-700
            shadow-md
            rounded-full
            px-2 py-0.5
            text-xs
            z-20
          `}
                                                                                >
                                                                                    {Object.entries(msg.reactions).map(([emoji, users]) =>
                                                                                        users.length > 0 ? (
                                                                                            <span key={emoji}>{emoji}</span>
                                                                                        ) : null
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                    </div>

                                                                    {activeReactionPicker === msg.id && (
                                                                        <div
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={`
      absolute
      ${isMe ? "right-12" : "left-12"}
      -top-[50px]
      flex items-center gap-2
      dark:bg-neutral-700
      px-3 py-2
      rounded-full
      shadow-xl
      z-50
    `}
                                                                        >
                                                                            {["❤️", "😂", "😮", "😢", "😡", "👍"].map((emoji) => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toggleReaction(msg, emoji);
                                                                                        setActiveReactionPicker(null);
                                                                                        setActiveActionMsg(null);
                                                                                    }}
                                                                                    className="text-xl hover:scale-125 transition"
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}

                                                                            {/* Plus button */}
                                                                            <button
                                                                                className="text-white text-lg hover:scale-110 transition"
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {/* 🔥 Desktop Action Buttons (SIDE) */}
                                                                    <div
                                                                        className={`
        hidden md:flex items-center gap-2
        transition-all duration-200
        opacity-0 translate-x-2
        group-hover:opacity-100 group-hover:translate-x-0
        ${isMe ? "order-first mr-2" : "ml-2"}
    `}
                                                                    >
                                                                        {/* React */}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveReactionPicker(
                                                                                    activeReactionPicker === msg.id ? null : msg.id
                                                                                );
                                                                            }}
                                                                            className="w-8 h-8 flex items-center justify-center
                   rounded-full dark:bg-neutral-700 dark:text-white bg-neutral-400 text-neutral-700 hover:scale-110 transition"
                                                                        >
                                                                            <Smile size={16} />
                                                                        </button>

                                                                        {/* Reply */}
                                                                        <button
                                                                            onClick={() => {
                                                                                setNewMessage(`@${activeUser?.name} `);
                                                                            }}
                                                                            className="w-8 h-8 flex items-center justify-center
                   rounded-full dark:bg-neutral-700 dark:text-white bg-neutral-400 text-neutral-700 hover:scale-110 transition"
                                                                        >
                                                                            <Reply size={16} />
                                                                        </button>

                                                                        {/* Delete (only your message) */}
                                                                        {isMe && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSelectedMsgs([msg.id]);
                                                                                    setShowMsgDeleteModal(true);
                                                                                }}
                                                                                className="w-8 h-8 flex items-center justify-center
                       rounded-full bg-red-600 text-white hover:scale-110 transition"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>



                                                                </div>
                                                            </div>
                                                        </motion.div>


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



                                    {selectedFiles.length > 0 && (
                                        <div className="px-4 py-3 border-t border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 flex gap-3 overflow-x-auto">
                                            {selectedFiles.map((file, index) => (
                                                <div key={index} className="relative">
                                                    {file.type.startsWith("image/") ? (
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            className="w-16 h-16 object-cover rounded-lg"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 flex items-center justify-center bg-neutral-700 rounded-lg text-xl">
                                                            📄
                                                        </div>
                                                    )}

                                                    {/* Remove single file */}
                                                    <button
                                                        onClick={() =>
                                                            setSelectedFiles((prev) =>
                                                                prev.filter((_, i) => i !== index)
                                                            )
                                                        }
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}


                                    {/* 🔽 Your existing input bar */}
                                    <div className="border-t border-neutral-300 dark:border-neutral-500 p-4 flex gap-3">

                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 dark:text-neutral-500 hover:text-white transition"
                                        >
                                            <Upload size={18} />
                                        </button>

                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={(e) => {
                                                if (!e.target.files) return;
                                                setSelectedFiles(Array.from(e.target.files));
                                            }}
                                        />


                                        {uploadProgress !== null && (
                                            <div className="px-4 py-2 text-xs text-neutral-500">
                                                Uploading... {uploadProgress}%
                                                <div className="w-full dark:bg-neutral-300 h-1 mt-1 rounded">
                                                    <div
                                                        className="h-1 rounded"
                                                        style={{
                                                            width: `${uploadProgress}%`,
                                                            backgroundColor: "var(--brand-color)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
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



                                            className="flex-1 bg-neutral-300 dark:bg-neutral-700 text-neutral-900 dark:text-white px-4 py-2 rounded-full outline-none"
                                            placeholder="Type a message..."
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={!newMessage.trim() && selectedFiles.length === 0}
                                            className=" p-2 transition-colors disabled:opacity-50"
                                        >
                                            <Send className="text-[var(--brand-color)]" size={22} />
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
                    <div className="md:hidden h-full relative overflow-hidden border-neutral-700 ">
                        <motion.div
                            className="flex h-full w-[95vw]"
                            animate={{ x: activeConversation ? "-95vw" : "0vw" }}
                            transition={{
                                type: "tween",
                                duration: 0.28,
                                ease: [0.4, 0, 0.2, 1]
                            }}
                        >
                            {/* Sidebar */}
                            <div className="w-full flex-shrink-0 border-r dark:border-neutral-800 border-neutral-300 flex flex-col">
                                <div className="flex items-center justify-between px-6 py-[19.5px] border-b border-neutral-400 dark:border-neutral-600">
                                    <h2 className="dark:text-neutral-100 text-[22px] font-semibold">Messages</h2>
                                    <div className="flex items-center gap-2">


                                        <button
                                            onClick={() => setShowNewChat(true)}
                                            style={{ backgroundColor: "var(--brand-color)" }}
                                            className="p-2 rounded-full"
                                        >
                                            <Plus className="text-white" size={17} />
                                        </button>



                                        {isConvDeleteMode && selectedConvs.length > 0 && (
                                            <button
                                                onClick={() => setShowDeleteModal(true)}
                                                className="pl-[10px] pr-0"
                                            >
                                                <Trash2 className="text-red-500" size={22} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                if (isConvDeleteMode) {
                                                    // Cancel delete mode
                                                    setIsConvDeleteMode(false);
                                                    setSelectedConvs([]);
                                                } else {
                                                    setIsConvDeleteMode(true);
                                                }
                                            }}
                                            className="pl-[15px] pr-[3px] transition"
                                        >
                                            {isConvDeleteMode ? (
                                                <X className="dark:text-white" size={22} />
                                            ) : (
                                                <Trash2 className="dark:text-white" size={22} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={location.pathname}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                    >
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

                                                const isReaction = conv.lastMessageType === "reaction";

                                                let previewText = "Start conversation";

                                                // 🔥 PRIORITY 1 — Reaction (overrides unread)
                                                if (isReaction && conv.lastMessage) {
                                                    previewText = conv.lastMessage;
                                                }

                                                // 🔥 PRIORITY 2 — Multiple unread
                                                else if (unreadCount > 1) {
                                                    previewText =
                                                        unreadCount > 9
                                                            ? "9+ new messages"
                                                            : `${unreadCount} new messages`;
                                                }

                                                // 🔥 PRIORITY 3 — Media
                                                else if (conv.lastMessageType === "image") {
                                                    previewText =
                                                        conv.lastSenderId === currentUser.id
                                                            ? "You sent a photo"
                                                            : `${otherUser.name} sent a photo`;
                                                }

                                                else if (conv.lastMessageType === "video") {
                                                    previewText =
                                                        conv.lastSenderId === currentUser.id
                                                            ? "You sent a video"
                                                            : `${otherUser.name} sent a video`;
                                                }

                                                else if (conv.lastMessageType === "file") {
                                                    previewText =
                                                        conv.lastSenderId === currentUser.id
                                                            ? "You sent a file"
                                                            : `${otherUser.name} sent a file`;
                                                }

                                                // 🔥 PRIORITY 4 — Normal message
                                                else if (conv.lastMessage) {
                                                    previewText = isReaction
                                                        ? conv.lastMessage
                                                        : conv.lastSenderId === currentUser.id
                                                            ? `You: ${conv.lastMessage}`
                                                            : conv.lastMessage;
                                                }

                                                return (
                                                    <div key={conv.id} className="flex items-center">
                                                        <div
                                                            onClick={async () => {
                                                                if (isConvDeleteMode) return;
                                                                if (activeConversation === conv.id) return;

                                                                setActiveConversation(conv.id);

                                                                await updateDoc(doc(db, "conversations", conv.id), {
                                                                    [`unread.${currentUser.id}`]: 0,
                                                                });
                                                            }}
                                                            className={`flex items-center justify-between p-4 cursor-pointer transition-all duration-200 w-full
                ${isActive
                                                                    ? "dark:bg-neutral-800 hover:bg-neutral-300 border-l-4 rounded border-[var(--brand-color)]"
                                                                    : "hover:bg-neutral-300 dark:hover:bg-neutral-600"
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3 w-full">
                                                                <div className="relative">
                                                                    <img
                                                                        src={otherUser.photo || "https://i.pravatar.cc/150"}
                                                                        className="w-10 h-10 rounded-full"
                                                                    />
                                                                    <span
                                                                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white 
                      ${onlineUsers[otherUser.id] ? "bg-green-500" : "hidden"}`}
                                                                    />
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <p
                                                                        className={`text-sm ${isActive
                                                                            ? "font-semibold text-[var(--brand-color)]"
                                                                            : isUnread && !isReaction
                                                                                ? "font-semibold text-neutral-900 dark:text-white"
                                                                                : "text-neutral-800 dark:text-white"
                                                                            }`}
                                                                    >
                                                                        {otherUser.name}
                                                                    </p>

                                                                    <p
                                                                        className={`text-xs truncate ${isUnread && !isReaction
                                                                            ? "font-semibold dark:text-white"
                                                                            : "text-neutral-500"
                                                                            }`}
                                                                    >
                                                                        {previewText}

                                                                        {conv.updatedAt?.toDate && (
                                                                            <> • {conv.updatedAt.toDate().toLocaleTimeString([], {
                                                                                hour: "2-digit",
                                                                                minute: "2-digit",
                                                                            })}</>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {isConvDeleteMode && (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedConvs.includes(conv.id)}
                                                                    onChange={() => {
                                                                        setSelectedConvs((prev) =>
                                                                            prev.includes(conv.id)
                                                                                ? prev.filter((id) => id !== conv.id)
                                                                                : [...prev, conv.id]
                                                                        );
                                                                    }}
                                                                    className="ml-4"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Chat */}
                            <div
                                className="w-full flex-shrink-0 flex flex-col"
                            >
                                {activeConversation && (
                                    <>
                                        <div className="flex items-center gap-3 p-4 border-b dark:border-neutral-700 border-neutral-300 ">
                                            <ArrowLeft
                                                size={22}
                                                className="dark:text-gray-300 cursor-pointer hover:text-white transition text-neutral-800"
                                                onClick={() => setActiveConversation(null)}
                                            />
                                            <div className="relative">
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

                                                {/* Status dot */}
                                                <span
                                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white 
                                                        ${activeUser && onlineUsers[activeUser.id]
                                                            ? "bg-green-500"
                                                            : "bg-neutral-400"
                                                        }`}
                                                />
                                            </div>

                                            <div>
                                                <p className="dark:text-white text-neutral-600 font-semibold text-sm">
                                                    {activeUser?.name || "User"}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-neutral-500 dark:text-neutral-400">
                                                        {activeUser && onlineUsers[activeUser.id] ? "Online" : "Offline"}
                                                    </span>
                                                    <span className="text-neutral-500 dark:text-neutral-400">
                                                        •
                                                    </span>
                                                    <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-2 text-xs">
                                                        {activeUser?.email}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="ml-auto flex items-center gap-2">

                                                {/* Toggle delete mode */}
                                                <button
                                                    onClick={() => {
                                                        if (isMsgDeleteMode) {
                                                            setIsMsgDeleteMode(false);
                                                            setSelectedMsgs([]);
                                                        } else {
                                                            setIsMsgDeleteMode(true);
                                                        }
                                                    }}
                                                    className="p-2 transition"
                                                >
                                                    {isMsgDeleteMode ? (
                                                        <X className="dark:text-white" size={22} />
                                                    ) : (
                                                        <Trash2 className="dark:text-white" size={22} />
                                                    )}
                                                </button>

                                                {/* Red delete when messages selected */}
                                                {isMsgDeleteMode && selectedMsgs.length > 0 && (
                                                    <button
                                                        onClick={() => setShowMsgDeleteModal(true)}
                                                        className="p-2"
                                                    >
                                                        <Trash2 className="text-red-500" size={22} />
                                                    </button>
                                                )}

                                            </div>
                                        </div>

                                        <div ref={messagesContainerRef} onClick={() => {
                                            setActiveActionMsg(null);
                                            setActiveReactionPicker(null);
                                        }} className="flex-1 overflow-y-auto p-6 space-y-4">
                                            {loadingMessages ? (
                                                <div className="flex items-center justify-center h-full text-neutral-400">
                                                    Loading conversation...
                                                </div>
                                            ) : (
                                                <>
                                                    {messages.map((msg) => {
                                                        const isMe = msg.senderId === currentUser.id;

                                                        return (
                                                            <motion.div
                                                                key={msg.id}
                                                                initial={{ opacity: 0, y: 5 }}
                                                                animate={{
                                                                    opacity: deletingMsgs.includes(msg.id) ? 0 : 1,
                                                                    y: deletingMsgs.includes(msg.id) ? -10 : 0,
                                                                    scale: deletingMsgs.includes(msg.id) ? 0.95 : 1,
                                                                }}
                                                                transition={{ duration: 0.3 }}

                                                                className={`flex items-center gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                                                            >
                                                                {isMsgDeleteMode && msg.senderId === currentUser.id && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedMsgs.includes(msg.id)}
                                                                        onChange={() => {
                                                                            setSelectedMsgs((prev) =>
                                                                                prev.includes(msg.id)
                                                                                    ? prev.filter((id) => id !== msg.id)
                                                                                    : [...prev, msg.id]
                                                                            );
                                                                        }}
                                                                        className="mr-2"
                                                                    />
                                                                )}

                                                                <div className="relative group max-w-[75%] ">
                                                                    <div className="flex relative">
                                                                        {/* Bubble */}
                                                                        <div
                                                                            style={
                                                                                isMe && msg.type !== "image"
                                                                                    ? { backgroundColor: "var(--brand-color)" }
                                                                                    : undefined
                                                                            }
                                                                            className={`rounded-2xl break-words whitespace-pre-wrap overflow-hidden ${msg.type === "image"
                                                                                ? "p-1"
                                                                                : `px-4 py-2 text-sm ${isMe
                                                                                    ? "text-white"
                                                                                    : "bg-neutral-300 text-neutral-900"
                                                                                }`
                                                                                }`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (window.innerWidth < 768) {
                                                                                    setActiveActionMsg(activeActionMsg === msg.id ? null : msg.id);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {(!msg.type || msg.type === "text") && msg.text}

                                                                            {msg.type === "image" && (
                                                                                <img
                                                                                    src={msg.fileUrl}
                                                                                    className="max-w-[260px] max-h-[300px] rounded-xl object-cover"
                                                                                />
                                                                            )}

                                                                            {msg.type === "file" && (
                                                                                <a
                                                                                    href={msg.fileUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="flex items-center gap-2"
                                                                                >
                                                                                    <FileIcon size={18} />
                                                                                    <span className="underline">{msg.fileName}</span>
                                                                                </a>
                                                                            )}
                                                                        </div>

                                                                        {/* 🔥 Action Buttons (RIGHT SIDE like Messenger) */}
                                                                        {activeActionMsg === msg.id && (
                                                                            <div
                                                                                className={`
                                                                             flex items-center gap-2 ml-2
                                                                                    ${isMe ? "order-first mr-2 ml-0" : ""}
                                                                             `}
                                                                            >
                                                                                {/* React */}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveReactionPicker(
                                                                                            activeReactionPicker === msg.id ? null : msg.id
                                                                                        );
                                                                                    }}
                                                                                    className="w-8 h-8 flex items-center justify-center 
                                                                                    rounded-full dark:bg-neutral-700 dark:text-white bg-neutral-400 text-neutral-700"
                                                                                >
                                                                                    <Smile size={16} />
                                                                                </button>

                                                                                {/* Reply */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setNewMessage(`@${activeUser?.name} `);
                                                                                        setActiveActionMsg(null);
                                                                                    }}
                                                                                    className="w-8 h-8 flex items-center justify-center 
                                                                                    rounded-full dark:bg-neutral-700 dark:text-white bg-neutral-400 text-neutral-700"
                                                                                >
                                                                                    <Reply size={16} />
                                                                                </button>

                                                                                {/* Delete (only your message) */}
                                                                                {isMe && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedMsgs([msg.id]);
                                                                                            setShowMsgDeleteModal(true);
                                                                                            setActiveActionMsg(null);
                                                                                        }}
                                                                                        className="w-8 h-8 flex items-center justify-center 
                                                                                         rounded-full bg-red-600 text-white"
                                                                                    >
                                                                                        <Trash size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {msg.reactions &&
                                                                            Object.entries(msg.reactions).some(
                                                                                ([_, users]) => users.length > 0
                                                                            ) && (
                                                                                <div
                                                                                    className={`
                absolute -bottom-3
                ${isMe ? "right-0 translate-x-2/2" : "left-0 -translate-x-1/4"}
                flex items-center gap-1
                bg-white dark:bg-neutral-700
                shadow-md
                rounded-full
                px-2 py-0.5
                text-xs
                z-20
            `}
                                                                                >
                                                                                    {Object.entries(msg.reactions).map(([emoji, users]) =>
                                                                                        users.length > 0 ? (
                                                                                            <span key={emoji}>{emoji}</span>
                                                                                        ) : null
                                                                                    )}



                                                                                </div>
                                                                            )}

                                                                        {activeReactionPicker === msg.id && (
                                                                            <div
                                                                                className={`
      absolute
      ${isMe ? "right-12" : "left-12"}
      -top-[50px]
      flex items-center gap-2
      dark:bg-neutral-700
      px-3 py-2
      rounded-full
      shadow-xl
      z-50
    `}
                                                                            >
                                                                                {["❤️", "😂", "😮", "😢", "😡", "👍"].map((emoji) => (
                                                                                    <button
                                                                                        key={emoji}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            toggleReaction(msg, emoji);
                                                                                            setActiveReactionPicker(null);
                                                                                            setActiveActionMsg(null);
                                                                                        }}
                                                                                        className="text-xl hover:scale-125 transition"
                                                                                    >
                                                                                        {emoji}
                                                                                    </button>
                                                                                ))}

                                                                                {/* Plus button */}
                                                                                <button
                                                                                    className="dark:text-white text-lg hover:scale-110 transition"
                                                                                >
                                                                                    +
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                </div>
                                                            </motion.div>

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


                                        {selectedFiles.length > 0 && (
                                            <div className="px-4 py-3 border-t border-neutral-700 bg-neutral-800 flex gap-3 overflow-x-auto">
                                                {selectedFiles.map((file, index) => (
                                                    <div key={index} className="relative">
                                                        {file.type.startsWith("image/") ? (
                                                            <img
                                                                src={URL.createObjectURL(file)}
                                                                className="w-16 h-16 object-cover rounded-lg"
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 flex items-center justify-center bg-neutral-700 rounded-lg text-xl">
                                                                📄
                                                            </div>
                                                        )}

                                                        {/* Remove single file */}
                                                        <button
                                                            onClick={() =>
                                                                setSelectedFiles((prev) =>
                                                                    prev.filter((_, i) => i !== index)
                                                                )
                                                            }
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="border-t border-neutral-300 dark:border-neutral-700 p-4 flex gap-3">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 text-neutral-500 hover:text-white transition"
                                            >
                                                <Upload size={22} />
                                            </button>

                                            <input
                                                type="file"
                                                multiple
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (!e.target.files) return;
                                                    setSelectedFiles(Array.from(e.target.files));
                                                }}
                                            />


                                            {uploadProgress !== null && (
                                                <div className="px-4 py-2 text-xs text-neutral-500">
                                                    Uploading... {uploadProgress}%
                                                    <div className="w-full bg-neutral-300 h-1 mt-1 rounded">
                                                        <div
                                                            className="h-1 rounded"
                                                            style={{
                                                                width: `${uploadProgress}%`,
                                                                backgroundColor: "var(--brand-color)",
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
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



                                                className="flex-1 bg-neutral-300 dark:bg-neutral-700 dark:text-white text-neutral-700 px-4 py-2 rounded-full outline-none"
                                                placeholder="Type a message..."
                                            />
                                            <button
                                                onClick={handleSend}

                                                disabled={!newMessage.trim() && selectedFiles.length === 0}
                                                className="p-2 transition-colors disabled:opacity-50"
                                            >
                                                <Send className="text-[var(--brand-color)]" size={22} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div >
        </AnimatePresence >
    );
}
