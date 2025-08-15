import { useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

const data = [
  { subject: 'Relevance', value: 85, fullMark: 100 },
  { subject: 'Tone', value: 78, fullMark: 100 },
  { subject: 'Length', value: 92, fullMark: 100 },
  { subject: 'Accuracy', value: 88, fullMark: 100 },
  { subject: 'Toxicity', value: 95, fullMark: 100 },
  { subject: 'Prompt Injection', value: 82, fullMark: 100 },
]

export default function MetricRadarChart() {
  const [toggleStates, setToggleStates] = useState({
    relevance: true,
    tone: true,
    length: true,
    accuracy: true,
    toxicity: true,
    promptInjection: true,
  })

  const toggleModule = (module: keyof typeof toggleStates) => {
    setToggleStates(prev => ({
      ...prev,
      [module]: !prev[module]
    }))
  }

  return (
    <div className="radar-container">
      <div className="radar-header">
        <div className="radar-title">Performance Radar</div>
        <div className="radar-subtitle">TecAce Ax Pro performance analysis and optimization</div>
      </div>
      
      <div className="radar-content">
        <div className="radar-chart-section">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid 
                gridType="polygon" 
                stroke="rgba(59, 230, 255, 0.2)"
                strokeWidth={1}
              />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ 
                  fill: 'var(--text)', 
                  fontSize: 12, 
                  fontWeight: 600 
                }}
                className="radar-labels"
              />
              <PolarRadiusAxis 
                domain={[0, 100]} 
                tick={{ 
                  fill: 'var(--text-muted)', 
                  fontSize: 10 
                }}
                tickCount={6}
                stroke="rgba(59, 230, 255, 0.1)"
              />
              <Radar
                name="Performance"
                dataKey="value"
                stroke="#3be6ff"
                fill="#3be6ff"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ 
                  fill: '#3be6ff', 
                  strokeWidth: 2, 
                  stroke: '#0c1330',
                  r: 4 
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          
          <div className="overall-score">
            <div className="score-circle">
              <div className="score-value">82</div>
              <div className="score-label">OVERALL</div>
            </div>
          </div>
        </div>
        
        <div className="radar-controls">
          <div className="radar-control-section">
            <div className="control-title">Module Control</div>
            <div className="control-badge">6 Active</div>
          </div>
          
          <div className="control-items">
            <div className="control-item">
              <div className="control-icon">⚡</div>
              <div className="control-info">
                <div className="control-name">Relevance</div>
                <div className="control-desc">Content Matching</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.relevance ? 'active' : ''}`} 
                onClick={() => toggleModule('relevance')}
              ></div>
            </div>
            
            <div className="control-item">
              <div className="control-icon">🎯</div>
              <div className="control-info">
                <div className="control-name">Tone</div>
                <div className="control-desc">Response Style</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.tone ? 'active' : ''}`} 
                onClick={() => toggleModule('tone')}
              ></div>
            </div>
            
            <div className="control-item">
              <div className="control-icon">📏</div>
              <div className="control-info">
                <div className="control-name">Length</div>
                <div className="control-desc">Response Size</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.length ? 'active' : ''}`} 
                onClick={() => toggleModule('length')}
              ></div>
            </div>
            
            <div className="control-item">
              <div className="control-icon">✓</div>
              <div className="control-info">
                <div className="control-name">Accuracy</div>
                <div className="control-desc">Correct Answers</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.accuracy ? 'active' : ''}`} 
                onClick={() => toggleModule('accuracy')}
              ></div>
            </div>
            
            <div className="control-item">
              <div className="control-icon">🛡️</div>
              <div className="control-info">
                <div className="control-name">Toxicity</div>
                <div className="control-desc">Safety Check</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.toxicity ? 'active' : ''}`} 
                onClick={() => toggleModule('toxicity')}
              ></div>
            </div>
            
            <div className="control-item">
              <div className="control-icon">🔒</div>
              <div className="control-info">
                <div className="control-name">Prompt Injection</div>
                <div className="control-desc">Security Filter</div>
              </div>
              <div 
                className={`control-toggle ${toggleStates.promptInjection ? 'active' : ''}`} 
                onClick={() => toggleModule('promptInjection')}
              ></div>
            </div>
          </div>
          

        </div>
      </div>
    </div>
  )
} 