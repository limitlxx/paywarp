"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Target, 
  Plus, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  Lock,
  Unlock,
  Loader2,
  AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { useSavingsGoals } from "@/hooks/use-savings-goals"
import { SavingsGoalModal } from "@/components/modals/savings-goal-modal"
import { cn } from "@/lib/utils"

export function SavingsGoalsManager() {
  const { 
    goals, 
    isLoading, 
    error, 
    contributeToGoal, 
    getActiveGoals, 
    getCompletedGoals, 
    getTotalProgress 
  } = useSavingsGoals()
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contributionAmounts, setContributionAmounts] = useState<Record<number, string>>({})
  const [contributingToGoal, setContributingToGoal] = useState<number | null>(null)

  const activeGoals = getActiveGoals()
  const completedGoals = getCompletedGoals()
  const { totalTarget, totalCurrent, overallProgress } = getTotalProgress()

  const handleContribute = async (goalId: number) => {
    const amount = parseFloat(contributionAmounts[goalId] || "0")
    
    if (amount <= 0) {
      return
    }

    try {
      setContributingToGoal(goalId)
      await contributeToGoal(goalId, amount)
      
      // Clear contribution amount after success
      setContributionAmounts(prev => ({ ...prev, [goalId]: "" }))
    } catch (error) {
      console.error('Failed to contribute to goal:', error)
    } finally {
      setContributingToGoal(null)
    }
  }

  const handleContributionChange = (goalId: number, value: string) => {
    setContributionAmounts(prev => ({ ...prev, [goalId]: value }))
  }

  if (error) {
    return (
      <Card className="glass-card border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <p>Failed to load savings goals: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-purple-400" />
            Savings Goals
          </h2>
          <p className="text-muted-foreground">
            Create goals with fund locking and earn bonus APY on completion
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="gradient-primary text-white gap-2"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4" />
          New Goal
        </Button>
      </div>

      {/* Overall Progress Summary */}
      {goals.length > 0 && (
        <Card className="glass-card border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-lg">Overall Progress</CardTitle>
            <CardDescription>
              Combined progress across all your savings goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Progress</span>
              <span className="font-bold text-foreground">
                ${totalCurrent.toLocaleString()} / ${totalTarget.toLocaleString()}
              </span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-400">{activeGoals.length}</p>
                <p className="text-xs text-muted-foreground">Active Goals</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{completedGoals.length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">
                  {overallProgress.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="glass border-purple-500/20 p-1 h-12">
          <TabsTrigger value="active" className="px-6 data-[state=active]:gradient-primary">
            Active Goals ({activeGoals.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="px-6 data-[state=active]:gradient-primary">
            Completed ({completedGoals.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Goals */}
        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p>Loading savings goals...</p>
                </div>
              </CardContent>
            </Card>
          ) : activeGoals.length === 0 ? (
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Goals</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first savings goal to start building towards your financial targets.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-primary text-white gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeGoals.map((goal) => (
                <Card key={goal.id} className="glass-card border-purple-500/20">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lock className="w-4 h-4 text-yellow-400" />
                          {goal.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {goal.description}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-yellow-500/20 text-yellow-400">
                        Locked
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-bold text-foreground">
                          ${goal.currentAmount.toLocaleString()} / ${goal.targetAmount.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={goal.progressPercent} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-400 font-medium">
                          {goal.progressPercent.toFixed(1)}% Complete
                        </span>
                        <span className="text-muted-foreground">
                          ${(goal.targetAmount - goal.currentAmount).toLocaleString()} remaining
                        </span>
                      </div>
                    </div>

                    {/* Goal Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="text-muted-foreground">Target Date</p>
                          <p className="font-medium">{format(goal.targetDate, "MMM dd, yyyy")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <div>
                          <p className="text-muted-foreground">Bonus APY</p>
                          <p className="font-medium text-green-400">+{goal.bonusAPY}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Contribution Section */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <Label className="text-sm font-medium">Add to Goal</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            value={contributionAmounts[goal.id] || ""}
                            onChange={(e) => handleContributionChange(goal.id, e.target.value)}
                            className="glass border-white/10 bg-transparent pl-8"
                            disabled={contributingToGoal === goal.id}
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                        </div>
                        <Button
                          onClick={() => handleContribute(goal.id)}
                          disabled={
                            !contributionAmounts[goal.id] || 
                            parseFloat(contributionAmounts[goal.id] || "0") <= 0 ||
                            contributingToGoal === goal.id
                          }
                          className="gradient-primary text-white px-6"
                        >
                          {contributingToGoal === goal.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Goals */}
        <TabsContent value="completed" className="space-y-4">
          {completedGoals.length === 0 ? (
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Completed Goals Yet</h3>
                <p className="text-muted-foreground">
                  Complete your active goals to see them here with their bonus rewards.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {completedGoals.map((goal) => (
                <Card key={goal.id} className="glass-card border-green-500/20">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          {goal.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {goal.description}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="border-green-500/20 text-green-400">
                        Completed
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Completion Details */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Final Amount</span>
                        <span className="font-bold text-green-400">
                          ${goal.currentAmount.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={100} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span className="text-green-400 font-medium">100% Complete</span>
                        <span className="text-green-400">Goal Achieved!</span>
                      </div>
                    </div>

                    {/* Completion Rewards */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-green-400" />
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium text-green-400">Unlocked</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <div>
                          <p className="text-muted-foreground">Bonus Earned</p>
                          <p className="font-medium text-green-400">+{goal.bonusAPY}% APY</p>
                        </div>
                      </div>
                    </div>

                    {/* Completion Date */}
                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-muted-foreground">Completed on:</span>
                        <span className="font-medium">{format(goal.targetDate, "MMM dd, yyyy")}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Goal Modal */}
      <SavingsGoalModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  )
}