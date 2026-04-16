import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PipelineProgress from './Pipeline/PipelineProgress'
import ScreenshotStep from './Steps/ScreenshotStep'
import AnalysisStep from './Steps/AnalysisStep'
import VoiceoverStep from './Steps/VoiceoverStep'
import TimelineStep from './Steps/TimelineStep'
import PreviewStep from './Steps/PreviewStep'
import { fetchWebsiteData, fetchTimeline, fetchScrapedData, fetchAudioFiles } from '../api/client'
import type { StepId } from '../types'

export default function WebsiteDetail() {
  const { domain } = useParams<{ domain: string }>()
  const [currentStep, setCurrentStep] = useState<StepId>('screenshot')

  const { data: websiteData, isLoading: loadingData } = useQuery({
    queryKey: ['website', domain],
    queryFn: () => fetchWebsiteData(domain!),
    enabled: !!domain,
  })

  const { data: timeline } = useQuery({
    queryKey: ['timeline', domain],
    queryFn: () => fetchTimeline(domain!),
    enabled: !!domain,
  })

  const { data: scrapedData } = useQuery({
    queryKey: ['scraped', domain],
    queryFn: () => fetchScrapedData(domain!),
    enabled: !!domain,
  })

  const { data: audioFiles } = useQuery({
    queryKey: ['audio', domain],
    queryFn: () => fetchAudioFiles(domain!),
    enabled: !!domain,
  })

  if (!domain) return null

  if (loadingData) {
    return (
      <div className="loading" style={{ height: '100%' }}>
        Loading website data...
      </div>
    )
  }

  const screenshots = websiteData?.steps?.screenshot?.files || []
  const completedSteps: StepId[] = []

  if (screenshots.length > 0) completedSteps.push('screenshot')
  if (websiteData?.steps?.analysis?.style || timeline?.style) completedSteps.push('analysis')
  if (audioFiles && audioFiles.length > 0) completedSteps.push('voiceover')
  if (timeline) completedSteps.push('timeline')
  if (websiteData?.steps?.render?.files?.length) completedSteps.push('preview')

  const renderStep = () => {
    switch (currentStep) {
      case 'screenshot':
        return (
          <ScreenshotStep
            domain={domain}
            screenshots={screenshots}
            scrapedData={scrapedData || null}
          />
        )
      case 'analysis':
        return (
          <AnalysisStep
            timeline={timeline || null}
            style={websiteData?.steps?.analysis?.style || null}
          />
        )
      case 'voiceover':
        return (
          <VoiceoverStep
            domain={domain}
            audioFiles={audioFiles || []}
          />
        )
      case 'timeline':
        return <TimelineStep domain={domain} timeline={timeline || null} />
      case 'preview':
        return (
          <PreviewStep
            domain={domain}
            website={{
              domain,
              createdAt: new Date().toISOString(),
              status: websiteData?.status || 'completed',
              hasLandscape: websiteData?.steps?.render?.files?.includes('landscape.mp4') || false,
              hasPortrait: websiteData?.steps?.render?.files?.includes('portrait.mp4') || false,
            }}
          />
        )
    }
  }

  return (
    <div>
      <PipelineProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={setCurrentStep}
      />
      {renderStep()}
    </div>
  )
}
