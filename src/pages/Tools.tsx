import { useState, useMemo, useEffect } from 'react'
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon, HistoryIcon, Trash2Icon, CheckCircleIcon, DownloadIcon
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Tool, ToolCategory } from '../types'
import { getRecentActivity, clearActivity } from '../utils/recentActivity'
import type { ActivityEntry } from '../utils/recentActivity'
import ToolsSkeleton from "../skeletons/ToolsSkeleton";

const categoryColors: Record<ToolCategory, { bg: string, text: string, border: string, hover: string, glow: string }> = {
  Edit: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-500',
    border: 'border-rose-100 dark:border-rose-900/30',
    hover: 'group-hover:bg-rose-500',
    glow: 'dark:hover:shadow-rose-900/20'
  },
  Secure: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-500',
    border: 'border-indigo-100 dark:border-indigo-900/30',
    hover: 'group-hover:bg-indigo-500',
    glow: 'dark:hover:shadow-indigo-900/20'
  },
  Convert: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-500',
    border: 'border-emerald-100 dark:border-emerald-900/30',
    hover: 'group-hover:bg-emerald-500',
    glow: 'dark:hover:shadow-emerald-900/20'
  },
  Optimize: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-500',
    border: 'border-amber-100 dark:border-amber-900/30',
    hover: 'group-hover:bg-amber-500',
    glow: 'dark:hover:shadow-amber-900/20'
  }
}

const ToolCard = ({ title, desc, icon: Icon, onClick, category }: Tool & { onClick?: () => void }) => {
  const colors = categoryColors[category]

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col p-6 rounded-[2rem] bg-neutral-100 dark:bg-neutral-700/50 border border-gray-100 dark:border-white/5 hover:border-[var(--brand-color)] dark:hover:border-[var(--brand-color)] transition-all duration-300 text-left hover:shadow-2xl hover:shadow-rose-500/5 hover:-translate-y-1"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg- ${colors.text} group-hover:bg-[var(--brand-color)] group-hover:text-white transition-all duration-500`}>
        <Icon size={24} strokeWidth={2} />
      </div>
      <h3 className="font-semibol text-gray-900 dark:text-white mb-2 text-lg tracking-tight group-hover:text-[var(--brand-color)] transition-colors">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium leading-relaxed line-clamp-2">{desc}</p>

      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--brand-color)]">
        <ChevronRightIcon size={20} />
      </div>
    </button>
  )
}

export default function Tools({ tools }: { tools: Tool[] }) {

  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [showHistory, setShowHistory] = useState(false)
  const categories: (ToolCategory | 'All')[] = ['All', 'Edit', 'Secure', 'Convert', 'Optimize']
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (showHistory) {
      getRecentActivity().then(setActivity)
    }
  }, [showHistory])

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch = tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.desc.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === 'All' || tool.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [tools, searchQuery, activeCategory])



  return (
    <div className="min-h-screen scroll-smooth">

      <h1 className="text-2xl font-bold dark:text-white">PDF Tools</h1>

      <div className="relative items-center mt-4 p-6 bg-gray-50 rounded-xl
                dark:bg-neutral-800">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight dark:text-white flex items-center gap-3">
            PDF Tools - A professional PDF engine
          </h1>
          <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium">
            The privacy-first PDF toolkit | 100% client-side logic | Zero servers | Open source and forever free | Powered by PaperKnife.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">

          {/* LEFT: Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider dark:hover:border-[var(--brand-color)] dark:hover:text-[var(--brand-color)]  transition-all border ${activeCategory === cat
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-transparent shadow"
                  : "bg-white dark:bg-zinc-900 text-gray-400 border-gray-200 dark:border-white/5 hover:border-rose-500"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">

            {/* Search */}
            <div className="relative flex-1 sm:w-72">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                <SearchIcon size={18} />
              </div>
              <input
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/5 
        rounded-full py-2.5 pl-10 pr-4 text-sm 
        focus:border-[var(--brand-color)]  focus:ring-1 focus:ring-[var(--brand-color)] 
        outline-none transition-all dark:text-white"
              />
            </div>


            <button
              onClick={() => setShowHistory(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all
      ${location.pathname === '/android-history'
                  ? 'bg-[var(--brand-color)] text-white border-transparent shadow'
                  : 'bg-white dark:bg-zinc-900 text-gray-400 dark:text-gray-400 border-gray-200 dark:border-white/5 dark:hover:border-[var(--brand-color)] dark:hover:text-[var(--brand-color)] hover:border-[var(--brand-color)] hover:text-[var(--brand-color)]'
                }`}
            >
              <HistoryIcon size={18} />
              <span className="text-[11px] font-bold">History</span>
            </button>

          </div>
        </div>









        {loading ? (
          <ToolsSkeleton />
        ) : filteredTools.length > 0 ? (
          <div className="grid 
    grid-cols-1 
    sm:grid-cols-2 
    lg:grid-cols-3 
    xl:grid-cols-4 
    gap-6"
          >
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.title}
                {...tool}
                onClick={() => navigate(tool.path || "/")}
              />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center col-span-full">
            <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <SearchIcon size={32} />
            </div>

            <h3 className="text-2xl font-black dark:text-white mb-2">
              No tools matched.
            </h3>

            <p className="text-gray-500 dark:text-zinc-400 font-medium">
              Try searching for a different keyword.
            </p>

            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("All");
              }}
              className="mt-8 text-rose-500 font-black uppercase tracking-widest text-xs hover:underline underline-offset-8"
            >
              Reset Filters
            </button>
          </div>
        )}

      </div>



      <aside className={`fixed top-0 right-0 h-screen w-full sm:w-80 bg-white dark:bg-neutral-900 border-l border-gray-100 dark:border-zinc-800 z-[150] shadow-2xl transition-transform duration-500 ease-out transform ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <HistoryIcon className="text-[var(--brand-color)]" size={24} />
              <h2 className="text-xl font-semibold dark:text-white">Activity</h2>
            </div>
            <div className="flex items-center gap-2">
              {activity.length > 0 && (
                <button
                  onClick={async () => { await clearActivity(); setActivity([]); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-[var(--brand-color)] rounded-xl transition-colors"
                >
                  <Trash2Icon size={18} />
                </button>
              )}
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <ChevronRightIcon size={20} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
            {activity.length === 0 ? (<div className="text-center py-20 opacity-40"><p className="text-xs font-bold uppercase tracking_widest text-gray-400">No recent files</p></div>) : (
              activity.map((item) => (
                <div key={item.id} className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-zinc-800 group relative">
                  <div className="flex items-center gap-3 mb-2"><div className="w-8 h-8 bg-[var(--brand-color)] text-white rounded-lg flex items-center justify-center"><CheckCircleIcon size={16} /></div><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate dark:text-white">{item.name}</p><p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">{item.tool}</p></div></div>
                  <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold"><span>{new Date(item.timestamp).toLocaleTimeString()}</span>{item.resultUrl && (<a href={item.resultUrl} download={item.name} className="text-[var(--brand-color)]  hover:underline flex items-center gap-1"><DownloadIcon size={10} /> Redownload</a>)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
      {showHistory && (<div onClick={() => setShowHistory(false)} className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm z-[140] animate-in fade-in duration-300" />)}
    </div>
  );
}
