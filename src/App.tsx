import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  lazy,
  Suspense,
} from "react";
import type { Tool } from './types'
import GlobalLoader from "./components/GlobalLoader";
import { useAuth } from "./context/AuthContext";
import {
  Layers, Scissors, Zap, Lock, Unlock,
  RotateCw, Type, Hash, Tags, FileText, ArrowUpDown, PenTool,
  Wrench, ImagePlus, FileImage, Palette
} from 'lucide-react'
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoutes"; // ✅ FIXED NAME

/* Lazy Pages */
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(
  () => import("./pages/Dashboard")
);
const Users = lazy(
  () => import("./pages/Users")
);
const Messages = lazy(
  () => import("./pages/Messages")
);
const Tools = lazy(
  () => import("./pages/Tools")
);

const Settings = lazy(() => import("./pages/Settings"));
// import PdfPreview from './components/PdfPreview'

// Tools - Also moving to static imports for stability in APK
import MergeTool from './components/tools/MergeTool'
import SplitTool from './components/tools/SplitTool'
import ProtectTool from './components/tools/ProtectTool'
import CompressTool from './components/tools/CompressTool'
import UnlockTool from './components/tools/UnlockTool'
import PdfToImageTool from './components/tools/PdfToImageTool'
import RotateTool from './components/tools/RotateTool'
import PdfToTextTool from './components/tools/PdfToTextTool'
import RearrangeTool from './components/tools/RearrangeTool'
import WatermarkTool from './components/tools/WatermarkTool'
import PageNumberTool from './components/tools/PageNumberTool'
import MetadataTool from './components/tools/MetadataTool'
import ImageToPdfTool from './components/tools/ImageToPdfTool'
import SignatureTool from './components/tools/SignatureTool'
import RepairTool from './components/tools/RepairTool'
import ExtractImagesTool from './components/tools/ExtractImagesTool'
import GrayscaleTool from './components/tools/GrayscaleTool'

const tools: Tool[] = [
  { title: 'Merge PDF', desc: 'Combine multiple PDF files into one document.', icon: Layers, implemented: true, path: '/dashboard/merge', category: 'Edit', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  { title: 'Split PDF', desc: 'Visually extract specific pages or ranges.', icon: Scissors, implemented: true, path: '/dashboard/split', category: 'Edit', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { title: 'Compress PDF', desc: 'Optimize your file size for easier sharing.', icon: Zap, implemented: true, path: '/dashboard/compress', category: 'Optimize', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { title: 'Protect PDF', desc: 'Secure your documents with strong encryption.', icon: Lock, implemented: true, path: '/dashboard/protect', category: 'Secure', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  { title: 'Unlock PDF', desc: 'Remove passwords from your protected files.', icon: Unlock, implemented: true, path: '/dashboard/unlock', category: 'Secure', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { title: 'Rotate PDF', desc: 'Fix page orientation permanently.', icon: RotateCw, implemented: true, path: '/dashboard/rotate-pdf', category: 'Edit', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { title: 'Rearrange PDF', desc: 'Drag and drop pages to reorder them.', icon: ArrowUpDown, implemented: true, path: '/dashboard/rearrange-pdf', category: 'Edit', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { title: 'Page Numbers', desc: 'Add numbering to your documents automatically.', icon: Hash, implemented: true, path: '/dashboard/page-numbers', category: 'Edit', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20' },
  { title: 'Watermark', desc: 'Overlay custom text for branding or security.', icon: Type, implemented: true, path: '/dashboard/watermark', category: 'Edit', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { title: 'Metadata', desc: 'Edit document properties for better privacy.', icon: Tags, implemented: true, path: '/dashboard/metadata', category: 'Secure', color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  { title: 'Signature', desc: 'Add your electronic signature to any document.', icon: PenTool, implemented: true, path: '/dashboard/signature', category: 'Edit', color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' },
  { title: 'Grayscale', desc: 'Convert all document pages to black and white.', icon: Palette, implemented: true, path: '/dashboard/grayscale', category: 'Optimize', color: 'text-zinc-500', bg: 'bg-zinc-50 dark:bg-zinc-900/20' },
  { title: 'PDF to Image', desc: 'Convert document pages into high-quality images.', icon: FileImage, implemented: true, path: '/dashboard/pdf-to-image', category: 'Convert', color: 'text-lime-500', bg: 'bg-lime-50 dark:bg-lime-900/20' },
  { title: 'Image to PDF', desc: 'Convert JPG, PNG, and WebP into a professional PDF.', icon: ImagePlus, implemented: true, path: '/dashboard/image-to-pdf', category: 'Convert', color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  { title: 'Extract Images', desc: 'Pull out all original images embedded in a PDF.', icon: FileImage, implemented: true, path: '/dashboard/extract-images', category: 'Convert', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { title: 'PDF to Text', desc: 'Extract plain text from your PDF documents.', icon: FileText, implemented: true, path: '/dashboard/pdf-to-text', category: 'Convert', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
  { title: 'Repair PDF', desc: 'Attempt to fix corrupted or unreadable documents.', icon: Wrench, implemented: true, path: '/dashboard/repair', category: 'Optimize', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
]
export const IS_OCR_DISABLED = import.meta.env.VITE_DISABLE_OCR === 'true'

export default function App() {
  const { loading } = useAuth();

  return (
    <>
      {/* Global Loader (Auth) */}
      {loading && <GlobalLoader />}

      {/* Lazy Loader */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>

          {/* ================= PUBLIC ================= */}
          <Route
            path="/"
            element={<Auth />}
          />

          {/* ================= PROTECTED ================= */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            {/* Admin → Users */}
            <Route
              path="/dashboard/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />

            {/* Admin → Messages */}
            <Route
              path="/dashboard/messages"
              element={
                <Messages />
              }
            />

            <Route
              path="/dashboard/tools"
              element={
                <Tools tools={tools} />
              }
            />
            <Route
              path="/dashboard/settings"
              element={<Settings />}
            />
            <Route path="/dashboard/merge" element={<MergeTool />} />
            <Route path="/dashboard/split" element={<SplitTool />} />
            <Route path="/dashboard/protect" element={<ProtectTool />} />
            <Route path="/dashboard/unlock" element={<UnlockTool />} />
            <Route path="/dashboard/compress" element={<CompressTool />} />
            <Route path="/dashboard/pdf-to-image" element={<PdfToImageTool />} />
            <Route path="/dashboard/rotate-pdf" element={<RotateTool />} />
            {!IS_OCR_DISABLED && <Route path="/dashboard/pdf-to-text" element={<PdfToTextTool />} />}
            <Route path="/dashboard/rearrange-pdf" element={<RearrangeTool />} />
            <Route path="/dashboard/watermark" element={<WatermarkTool />} />
            <Route path="/dashboard/page-numbers" element={<PageNumberTool />} />
            <Route path="/dashboard/metadata" element={<MetadataTool />} />
            <Route path="/dashboard/image-to-pdf" element={<ImageToPdfTool />} />
            <Route path="/dashboard/signature" element={<SignatureTool />} />
            <Route path="/dashboard/repair" element={<RepairTool />} />
            <Route path="/dashboard/extract-images" element={<ExtractImagesTool />} />
            <Route path="/dashboard/grayscale" element={<GrayscaleTool />} />

          </Route>

          {/* ================= FALLBACK ================= */}
          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

        </Routes>
      </Suspense>
    </>
  );
}
