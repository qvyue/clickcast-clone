import clsx from 'clsx'
import type { StepId } from '../../types'
import { STEPS } from '../../types'

interface PipelineProgressProps {
  currentStep: StepId
  completedSteps: StepId[]
  onStepClick: (step: StepId) => void
}

export default function PipelineProgress({
  currentStep,
  completedSteps,
  onStepClick,
}: PipelineProgressProps) {
  return (
    <div className="pipeline-progress">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id)
        const isActive = currentStep === step.id

        return (
          <div key={step.id} className="step-item-wrapper">
            <div
              className={clsx('step-item', {
                completed: isCompleted,
                active: isActive,
              })}
              onClick={() => onStepClick(step.id)}
            >
              <div className="step-icon">{step.icon}</div>
              <span className="step-label">{step.label}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={clsx('step-connector', {
                  completed: isCompleted,
                })}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
