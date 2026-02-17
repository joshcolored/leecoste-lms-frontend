import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import { useEffect, useState, useRef } from "react";
import { Send } from "lucide-react";

/* ================= TYPES ================= */

interface AppUser {
  id: string;
  name: string;
  email: string;
  photo?: string;
  isOnline?: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  unread?: Record<string, number>;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  seenBy: string[];
  reactions?: Record<string, string>;
}

/* ========================================= */

export default function Messages() {
  const auth = getAuth();
  const firebaseUser = auth.currentUser;

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [showNewChat, setShowNewChat] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  /* ================= ONLINE PRESENCE ================= */

  useEffect(() => {
    if (!firebaseUser) return;

    const userRef = doc(db, "users", firebaseUser.uid);

    updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    return () => {
      updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    };
  }, [firebaseUser]);

  /* ================= FETCH CURRENT USER ================= */

  useEffect(() => {
    if (!firebaseUser) return;

    const fetchUser = async () => {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (snap.exists()) {
        setCurrentUser({ id: snap.id, ...snap.data() } as AppUser);
      }
    };

    fetchUser();
  }, [firebaseUser]);

  /* ================= LOAD USERS ================= */

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: AppUser[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppUser))
        .filter((u) => u.id !== firebaseUser?.uid);

      setUsers(list);
    });

    return () => unsub();
  }, []);

  /* ================= SEARCH USERS ================= */

  useEffect(() => {
    if (!searchUser.trim()) {
      setSearchResults([]);
      return;
    }

    const fetchUsers = async () => {
      const q = query(
        collection(db, "users"),
        where("email", ">=", searchUser),
        where("email", "<=", searchUser + "\uf8ff")
      );

      const snap = await getDocs(q);

      const list: AppUser[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppUser))
        .filter((u) => u.id !== currentUser?.id);

      setSearchResults(list);
    };

    fetchUsers();
  }, [searchUser]);

  /* ================= LOAD CONVERSATIONS ================= */

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUser.id)
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
    if (!activeConversation || !currentUser) return;

    const q = query(
      collection(db, "conversations", activeConversation, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const list: Message[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];

      setMessages(list);

      snap.docs.forEach(async (d) => {
        const msg = d.data();
        if (!msg.seenBy?.includes(currentUser.id)) {
          await updateDoc(d.ref, {
            seenBy: arrayUnion(currentUser.id),
          });
        }
      });

      await updateDoc(doc(db, "conversations", activeConversation), {
        [`unread.${currentUser.id}`]: 0,
      });
    });

    return () => unsub();
  }, [activeConversation, currentUser]);

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
        unread: {
          [currentUser.id]: 0,
          [user.id]: 0,
        },
        updatedAt: serverTimestamp(),
      });

      setActiveConversation(newConv.id);
    }
  };

  /* ================= SEND MESSAGE ================= */

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConversation) return;

    const convRef = doc(db, "conversations", activeConversation);

    await addDoc(
      collection(db, "conversations", activeConversation, "messages"),
      {
        text: newMessage,
        senderId: currentUser.id,
        createdAt: serverTimestamp(),
        seenBy: [currentUser.id],
        reactions: {},
      }
    );

    const convSnap = await getDoc(convRef);
    const convData = convSnap.data() as Conversation;

    const otherId = convData.participants.find(
      (p) => p !== currentUser.id
    );

    await updateDoc(convRef, {
      lastMessage: newMessage,
      updatedAt: serverTimestamp(),
      [`unread.${otherId}`]: (convData.unread?.[otherId!] || 0) + 1,
    });

    setNewMessage("");
  };

  /* ================= UI ================= */

  return (
    <div className="relative flex h-[calc(100vh-120px)] bg-neutral-900 rounded-xl border border-neutral-800">

      {/* SIDEBAR */}
      <div className="w-80 border-r border-neutral-800 flex flex-col">

        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Chats</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="bg-indigo-600 text-xs px-3 py-1 rounded-full"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const otherId = conv.participants.find(
              (p) => p !== currentUser.id
            );

            const otherUser = users.find((u) => u.id === otherId);
            if (!otherUser) return null;

            const unreadCount = conv.unread?.[currentUser.id] || 0;

            return (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-800 ${
                  activeConversation === conv.id && "bg-neutral-800"
                }`}
              >
                <div className="relative">
                  <img
                    src={otherUser.photo || "https://i.pravatar.cc/150"}
                    className="w-12 h-12 rounded-full"
                  />
                  {otherUser.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-neutral-900" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {otherUser.name}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {conv.lastMessage || "Start conversation"}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <span className="bg-indigo-600 text-xs px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl text-sm ${
                    isMe
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-800 text-neutral-200"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {activeConversation && (
          <div className="border-t border-neutral-800 p-4 flex gap-3">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-full outline-none"
              placeholder="Type a message..."
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 p-2 rounded-full"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>

      {/* NEW CHAT MODAL */}
      {showNewChat && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 w-96 rounded-xl p-6 border border-neutral-800 shadow-xl">

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">New Conversation</h3>
              <button
                onClick={() => setShowNewChat(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <input
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Search by email..."
              className="w-full bg-neutral-800 text-white px-4 py-2 rounded-full outline-none mb-4"
            />

            <div className="max-h-60 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    startConversation(user);
                    setShowNewChat(false);
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-neutral-800 cursor-pointer rounded"
                >
                  <img
                    src={user.photo || "https://i.pravatar.cc/150"}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="text-sm text-white">{user.name}</p>
                    <p className="text-xs text-neutral-400">{user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
