import { useState, useCallback, useRef, useEffect } from "react";
import Cropper from "react-easy-crop";
import { getAuth, updateProfile } from "firebase/auth";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { v4 as uuid } from "uuid";
import ProfileSkeleton from "../skeletons/ProfileSkeleton";

/* Crop + Resize + Compress */
async function processImage(
  imageSrc: string,
  pixelCrop: any
): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;

  await new Promise((res) => (image.onload = res));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const SIZE = 512;

  canvas.width = SIZE;
  canvas.height = SIZE;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    SIZE,
    SIZE
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob!),
      "image/jpeg",
      0.8
    );
  });
}

export default function Profile() {
  const { user, loading } = useAuth();
  const auth = getAuth();

  const fileRef = useRef<HTMLInputElement>(null);

  /* Profile */
  const [name, setName] = useState(user?.displayName || "");
  const [photo, setPhoto] = useState<string | null>(null);

  /* Modal */
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  /* Drag */
  const [drag, setDrag] = useState(false);

  /* Cropper */
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<any>(null);

  /* Upload */
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  /* Animate modal */
  useEffect(() => {
    if (open) {
      setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
    }
  }, [open]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const onCropComplete = useCallback((_: any, area: any) => {
    setCroppedArea(area);
  }, []);

  /* Load file */
  const loadFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setToast({
        type: "error",
        message: "File too large. Max size is 5MB.",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      setToast({
        type: "error",
        message: "Only images allowed.",
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImage(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  /* Input */
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    loadFile(e.target.files[0]);
  };

  /* Drag drop */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);

    if (e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  /* Apply crop */
  const handleCropSave = async () => {
    if (!image || !croppedArea) return;

    const blob = await processImage(image, croppedArea);
    const preview = URL.createObjectURL(blob);

    setPhoto(preview);
    setOpen(false);
  };

  /* Delete old avatar */
  const deleteOldAvatar = async () => {
    if (!user?.photoURL) return;

    try {
      if (!user.photoURL.includes("firebasestorage")) return;

      const path = decodeURIComponent(
        user.photoURL.split("/o/")[1].split("?")[0]
      );

      await deleteObject(ref(storage, path));
    } catch {
      console.log("Old avatar already deleted");
    }
  };

  /* Save profile */
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setProgress(0);

      let photoURL = user.photoURL;

      if (photo) {
        await deleteOldAvatar();

        const res = await fetch(photo);
        const blob = await res.blob();

        const imgRef = ref(
          storage,
          `users/${user.uid}/avatar-${uuid()}.jpg`
        );

        const uploadTask = uploadBytesResumable(
          imgRef,
          blob
        );

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",

            (snap) => {
              const percent =
                (snap.bytesTransferred /
                  snap.totalBytes) *
                100;

              setProgress(Math.round(percent));
            },

            (err) => reject(err),

            () => resolve()
          );
        });

        photoURL = await getDownloadURL(
          uploadTask.snapshot.ref
        );
      }

      await updateProfile(auth.currentUser!, {
        displayName: name,
        photoURL,
      });

      setToast({
        type: "success",
        message: "Profile updated!",
      });

      await auth.currentUser?.reload();
      setProgress(0);

    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

if (loading) return <ProfileSkeleton />;

  if (!user) return null;


  return (
    <div className="mx-auto bg-white p-6 rounded-xl shadow">

      {/* Toast */}
      {toast && (
        <div
          className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-50
      px-6 py-3 rounded-lg shadow-lg text-sm font-medium

      transition-all duration-300 ease-in-out

      ${toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
            }

      animate-toast
    `}
        >
          {toast.message}
        </div>
      )}


      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">

        <img
          src={
            photo ||
            user.photoURL ||
            `https://ui-avatars.com/api/?name=${user.displayName}`
          }
          className="w-24 h-24 rounded-full border object-cover"
        />

        <button
          onClick={() => setOpen(true)}
          className="text-indigo-600 text-sm hover:underline"
        >
          Change Photo
        </button>

      </div>

      {/* Name */}
      <div className="mb-4 md:w-1/2">

        <label className="block text-sm mb-1">
          Full Name
        </label>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

      </div>

      {/* Email */}
      <div className="mb-4 md:w-1/2">

        <label className="block text-sm mb-1">
          Email
        </label>

        <input
          value={user.email || ""}
          disabled
          className="w-full border rounded-lg px-3 py-2 bg-gray-100"
        />

      </div>

      {/* Progress */}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">

          <div
            className="bg-indigo-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />

        </div>
      )}

      {/* Save */}
      <button
        disabled={saving}
        onClick={handleSave}
        className="bg-indigo-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
      >
        {saving ? `Uploading ${progress}%` : "Save Changes"}
      </button>

      {/* ============ MODAL ============ */}

      {open && (
        <div
          className={`
            fixed inset-0 z-50 flex items-center justify-center
            bg-black/50 transition-opacity duration-300
            ${show ? "opacity-100" : "opacity-0"}
          `}
        >

          <div
            className={`
              bg-white w-full max-w-lg rounded-xl shadow p-5
              transform transition-all duration-300
              ${show ? "scale-100" : "scale-95"}
            `}
          >

            <h3 className="font-semibold mb-4">
              Update Profile Photo
            </h3>

            {/* Upload */}
            {!image && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`
                  text-center py-12 border-2 border-dashed rounded-lg
                  cursor-pointer transition
                  ${drag
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-300"
                  }
                `}
              >

                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleSelect}
                />

                <p className="text-sm text-gray-500">
                  Drag & drop or click to upload
                </p>

              </div>
            )}

            {/* Cropper */}
            {image && (
              <>

                <div className="relative h-64 bg-black mb-4">

                  <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />

                </div>

                {/* Zoom */}
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) =>
                    setZoom(Number(e.target.value))
                  }
                  className="w-full mb-4"
                />

              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">

              <button
                onClick={() => {
                  setOpen(false);
                  setImage(null);
                  setDrag(false);
                }}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>

              <button
                disabled={!image}
                onClick={handleCropSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                Apply
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
