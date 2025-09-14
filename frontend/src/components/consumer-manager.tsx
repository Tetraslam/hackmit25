"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Zap, Settings, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Consumer {
  id: number
  name: string
  demand: number
  fulfillment: number
  isNew?: boolean
}

interface ConsumerManagerProps {
  consumers: Consumer[]
  onAddConsumer: (consumer: Omit<Consumer, 'id' | 'fulfillment' | 'isNew'>) => void
  onRemoveConsumer: (id: number) => void
}

export function ConsumerManager({ consumers, onAddConsumer, onRemoveConsumer }: ConsumerManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newConsumerName, setNewConsumerName] = useState("")
  const [newConsumerDemand, setNewConsumerDemand] = useState("")

  const handleAddConsumer = () => {
    if (!newConsumerName.trim() || !newConsumerDemand) {
      toast.error("Please fill in all fields")
      return
    }

    const demand = parseFloat(newConsumerDemand)
    if (isNaN(demand) || demand <= 0) {
      toast.error("Demand must be a positive number")
      return
    }

    onAddConsumer({
      name: newConsumerName.trim(),
      demand: demand
    })

    // Show success notification
    toast.success(`Consumer "${newConsumerName}" added successfully!`, {
      description: `Demand: ${demand}A`,
      action: {
        label: "View",
        onClick: () => {
          // Scroll to consumer or highlight it
          const element = document.getElementById(`consumer-${consumers.length + 1}`)
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    })

    // Reset form
    setNewConsumerName("")
    setNewConsumerDemand("")
    setIsAdding(false)
  }

  const handleRemoveConsumer = (id: number, name: string) => {
    onRemoveConsumer(id)
    toast.success(`Consumer "${name}" removed`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Consumer Management
            </CardTitle>
            <CardDescription>
              Add and manage power consumers in real-time
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {consumers.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Consumer Form */}
        {isAdding ? (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <div className="grid gap-2">
              <Label htmlFor="consumer-name">Consumer Name</Label>
              <Input
                id="consumer-name"
                placeholder="e.g., LED Strip, Motor, Sensor"
                value={newConsumerName}
                onChange={(e) => setNewConsumerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && newConsumerDemand && handleAddConsumer()}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="consumer-demand">Power Demand (A)</Label>
              <Input
                id="consumer-demand"
                type="number"
                placeholder="e.g., 2.5"
                step="0.1"
                min="0.1"
                value={newConsumerDemand}
                onChange={(e) => setNewConsumerDemand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && newConsumerName && handleAddConsumer()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddConsumer} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Add Consumer
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            onClick={() => setIsAdding(true)} 
            className="w-full"
            variant="dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Consumer
          </Button>
        )}

        {/* Consumer List */}
        <div className="space-y-2">
          {consumers.map((consumer, index) => (
            <div
              key={consumer.id}
              id={`consumer-${consumer.id}`}
              className={`
                flex items-center justify-between p-3 border rounded-lg
                transition-all duration-500 ease-in-out
                ${consumer.isNew ? 'animate-slide-in-right bg-green-50 border-green-200' : 'bg-background'}
                hover:bg-muted/50
              `}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <div className="font-medium">{consumer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Node ID: {consumer.id}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-mono">
                    {consumer.demand.toFixed(1)}A
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {consumer.fulfillment.toFixed(1)}% fulfilled
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveConsumer(consumer.id, consumer.name)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          
          {consumers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No consumers added yet</p>
              <p className="text-sm">Click "Add New Consumer" to get started</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
