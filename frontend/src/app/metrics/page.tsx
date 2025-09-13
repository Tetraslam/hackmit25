"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody as Tbody, TableCell as Td, TableHead as Th, TableHeader as Thead, TableRow as Tr } from "@/components/ui/table"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Separator } from "@/components/ui/separator"

type NodeReading = {
  id: number
  type: "power" | "consumer"
  demand: number
  fulfillment: number
}

type Snapshot = {
  timestamp: number
  nodes: NodeReading[]
}

const POLL_MS = 2000

export default function MetricsPage() {
  const [history, setHistory] = useState<Snapshot[]>([])

  useEffect(() => {
    let cancelled = false
    async function fetchLoop() {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" })
        if (res.ok) {
          const data: Snapshot = await res.json()
          if (!cancelled) setHistory((h) => [...h.slice(-150), data])
        }
      } catch {}
      if (!cancelled) setTimeout(fetchLoop, POLL_MS)
    }
    fetchLoop()
    return () => {
      cancelled = true
    }
  }, [])

  const latest = history[history.length - 1]
  const chartData = useMemo(() => {
    return history.map((s) => ({
      t: new Date(s.timestamp).toLocaleTimeString(),
      supply: s.nodes.filter((n) => n.type === "power").reduce((a, b) => a + b.fulfillment, 0),
      demand: s.nodes.filter((n) => n.type === "consumer").reduce((a, b) => a + b.demand, 0),
      routed: s.nodes.filter((n) => n.type === "consumer").reduce((a, b) => a + b.fulfillment, 0),
    }))
  }, [history])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Live Metrics</h1>
      <p className="text-muted-foreground">Updates every ~2 seconds from the backend.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Supply vs Demand</CardTitle>
            <CardDescription>Total across nodes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ demand: { label: "Demand", color: "hsl(var(--chart-2))" }, supply: { label: "Supply", color: "hsl(var(--chart-1))" }, routed: { label: "Routed", color: "hsl(var(--chart-3))" } }}
            >
              <LineChart data={chartData} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="demand" stroke="var(--color-demand)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="supply" stroke="var(--color-supply)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="routed" stroke="var(--color-routed)" dot={false} strokeWidth={2} />
                <ChartLegend content={<ChartLegendContent />} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Snapshot</CardTitle>
            <CardDescription>{latest ? new Date(latest.timestamp).toLocaleTimeString() : "—"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm grid grid-cols-3 gap-3">
              <div>
                <div className="text-muted-foreground">Consumers</div>
                <div className="font-mono">
                  {latest ? latest.nodes.filter((n) => n.type === "consumer").length : 0}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Supply (A)</div>
                <div className="font-mono">
                  {latest ? latest.nodes.filter((n) => n.type === "power").reduce((a, b) => a + b.fulfillment, 0).toFixed(2) : "0.00"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Routed (A)</div>
                <div className="font-mono">
                  {latest ? latest.nodes.filter((n) => n.type === "consumer").reduce((a, b) => a + b.fulfillment, 0).toFixed(2) : "0.00"}
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Demand (A)</Th>
                    <Th className="text-right">Fulfillment (A)</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {latest?.nodes.map((n) => (
                    <Tr key={n.id}>
                      <Td className="font-mono">{n.id}</Td>
                      <Td>{n.type}</Td>
                      <Td className="text-right font-mono">{n.demand.toFixed(2)}</Td>
                      <Td className="text-right font-mono">{n.fulfillment.toFixed(2)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}


