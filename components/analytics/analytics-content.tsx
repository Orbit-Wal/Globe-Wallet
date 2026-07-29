"use client"

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, Clock, Target, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import dynamic from "next/dynamic"
import type { AnalyticsStat, ChartDataPoint } from "@/lib/types"
import { buildVolumeHistory, buildCategoryBreakdown } from "@/lib/analytics/chart-data"
import { MOCK_TRANSACTIONS } from "@/lib/fixtures/transactions"

const VolumeChart = dynamic(
  () => import("./analytics-charts").then((mod) => mod.VolumeChart),
  { ssr: false, loading: () => <Card className="p-6 h-[284px] flex items-center justify-center">Loading chart...</Card> }
)
const CategoryChart = dynamic(
  () => import("./analytics-charts").then((mod) => mod.CategoryChart),
  { ssr: false, loading: () => <Card className="p-6 h-[284px] flex items-center justify-center">Loading chart...</Card> }
)

// -- Static stat definitions for task-completion metrics ----------------------

interface StatDefinition {
  title: string
  value: string
  subtitle?: string
  change: string
  trend: "up" | "down" | "flat"
  icon: React.ComponentType<{ className?: string }>
}

const TASK_STATS: StatDefinition[] = [
  { title: "Total Tasks Completed", value: "247",  change: "+12%", trend: "up",   icon: CheckCircle },
  { title: "Active Projects",        value: "12",   change: "+3",   trend: "up",   icon: Target      },
  { title: "Team Members",           value: "24",   change: "-2",   trend: "down", icon: Users       },
  { title: "Avg. Completion Time",   value: "2.3",  subtitle: "days", change: "-0.5", trend: "up", icon: Clock },
]

// -- Sub-components ------------------------------------------------------------

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")   return <TrendingUp  className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-700 dark:text-red-400"  />
  return <Minus className="w-3 h-3 text-muted-foreground" />
}

function StatCard({ stat, index, hovered, onEnter, onLeave }: {
  stat: StatDefinition
  index: number
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const trendColor = stat.trend === "up" ? "text-emerald-700 dark:text-emerald-400" : stat.trend === "down" ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
  return (
    <Card
      data-testid={`analytics-stat-${index}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ animationDelay: `${index * 100}ms` }}
      className={`bg-card text-foreground p-4 transition-all duration-500 ease-out animate-slide-in-up cursor-pointer ${hovered ? "scale-105 shadow-2xl" : "shadow-lg"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-full">
            <stat.icon className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <h3 className="text-xs font-medium opacity-90">{stat.title}</h3>
        </div>
        <div
          className={`w-6 h-6 rounded-full bg-primary flex items-center justify-center transition-transform duration-300 ${hovered ? "rotate-45" : ""}`}
          aria-hidden="true"
        >
          <ArrowUpRight className="w-3 h-3 text-primary-foreground" />
        </div>
      </div>
      <p className="text-3xl font-bold mb-2">
        {stat.value}
        {stat.subtitle && <span className="text-base font-normal ml-1">{stat.subtitle}</span>}
      </p>
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        <TrendIcon trend={stat.trend} />
        <span className={trendColor}>{stat.change}</span>
      </div>
    </Card>
  )
}

// -- Main exported component ---------------------------------------------------

export function AnalyticsContent() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [volumeData, setVolumeData] = useState<ChartDataPoint[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; volume: number; count: number }[]>([])

  useEffect(() => {
    const volume = buildVolumeHistory(MOCK_TRANSACTIONS, 'day')
    setVolumeData(volume)

    const breakdown = buildCategoryBreakdown(MOCK_TRANSACTIONS)
    const cats = breakdown.map((b) => ({
      name: b.category,
      volume: b.volume,
      count: b.count,
    }))
    setCategoryData(cats)
  }, [])

  return (
    <div className="space-y-6 animate-fade-in" data-testid="analytics-content">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TASK_STATS.map((stat, index) => (
          <StatCard
            key={stat.title}
            stat={stat}
            index={index}
            hovered={hoveredCard === index}
            onEnter={() => setHoveredCard(index)}
            onLeave={() => setHoveredCard(null)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumeChart data={volumeData} />
        <CategoryChart data={categoryData} />
      </div>
    </div>
  )
}
