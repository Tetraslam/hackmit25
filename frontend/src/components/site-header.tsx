"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Gauge, Home } from "lucide-react"

export function SiteHeader() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const icon = mounted && (resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />)
  const next = resolvedTheme === "dark" ? "light" : "dark"

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Home size={18} />
            <span>Griddy</span>
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/metrics" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Gauge size={18} />
            <span className="hidden sm:inline">Metrics</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label="Toggle theme">
            {icon}
          </Button>
        </div>
      </div>
    </header>
  )
}


