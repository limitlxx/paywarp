"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Target, Plus, Zap, TrendingUp, CheckCircle } from "lucide-react"
import { useSavingsGoals } from "@/hooks/use-savings-goals"
import { SavingsGoalModal } from "@/components/modals/savings-goal-modal"

export function SavingsGoalOverview() {
  const { goals, getActiveGoals, getTotalProgress } = useSavingsGoals()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const activeGoals = getActiveGoals()
  const { totalTarget, totalCurrent, overallProgress } = getTotalProgress()
  
  // Get the most recent active goal for display
  const primaryGoal = activeGoals[0]

  if (goals.length === 0) {
    return (
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Savings Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No savings goals yet. Create your first goal to start building towards your financial targets.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
              className="gradient-primary text-white gap-1"
            >
              <Plus className="w-3 h-3" />
              Create Goal
            </Button>
          </div>
          
          <SavingsGoalModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
          />
        </CardContent>
      </Card>
    )
  }

  if (activeGoals.length === 0) {
    // All goals completed
    return (
      <Card className="glass-card border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Savings Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-2">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-400 font-medium mb-1">
              All goals completed! 🎉
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              You've achieved {goals.length} savings goal{goals.length > 1 ? 's' : ''}. Create a new one to keep building wealth.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="sm"
              className="gradient-primary text-white gap-1"
            >
              <Plus className="w-3 h-3" />
              New Goal
            </Button>
          </div>
          
          <SavingsGoalModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            {activeGoals.length > 1 ? 'Savings Goals' : primaryGoal?.name}
          </CardTitle>
          {activeGoals.length > 1 && (
            <Badge variant="outline" className="border-purple-500/20 text-purple-400">
              {activeGoals.length} Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeGoals.length === 1 && primaryGoal ? (
          // Single goal display
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground font-bold">
                ${primaryGoal.currentAmount.toLocaleString()} / ${primaryGoal.targetAmount.toLocaleString()}
              </span>
            </div>
            <Progress value={primaryGoal.progressPercent} className="h-3" />
            
            {primaryGoal.progressPercent >= 100 ? (
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" />
                GOAL COMPLETE: +{primaryGoal.bonusAPY}% BONUS APY UNLOCKED
              </div>
            ) : (
              <div className="flex justify-between text-xs">
                <span className="text-purple-400 font-medium">
                  {primaryGoal.progressPercent.toFixed(1)}% complete
                </span>
                <span className="text-muted-foreground">
                  ${(primaryGoal.targetAmount - primaryGoal.currentAmount).toLocaleString()} remaining
                </span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              {primaryGoal.description}
            </p>
          </>
        ) : (
          // Multiple goals summary
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="text-foreground font-bold">
                ${totalCurrent.toLocaleString()} / ${totalTarget.toLocaleString()}
              </span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{activeGoals.length}</p>
                <p className="text-muted-foreground">Active Goals</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-400">{overallProgress.toFixed(1)}%</p>
                <p className="text-muted-foreground">Complete</p>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              You're making great progress across {activeGoals.length} savings goals. Keep it up!
            </p>
          </>
        )}
        
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            variant="outline"
            className="flex-1 glass border-purple-500/20 text-purple-400 gap-1"
          >
            <Plus className="w-3 h-3" />
            New Goal
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 glass border-blue-500/20 text-blue-400 gap-1"
          >
            <TrendingUp className="w-3 h-3" />
            View All
          </Button>
        </div>
        
        <SavingsGoalModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
        />
      </CardContent>
    </Card>
  )
}