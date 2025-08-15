import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconGear, IconLogout, IconX } from '../ui/icons';

import { getAuthToken } from '../services/auth';
import { fetchSessions } from '../services/sessions';
import { fetchSessionRequests } from '../services/requests';
import { fetchRequestDetail } from '../services/requestDetails';

import MetricRadarChart from '../components/MetricRadarChart';
import PromptControl from '../components/PromptControl';
import UserFeedback from '../components/UserFeedback';

import '../styles/dashboard.css';
import '../styles/radar.css';
import '../styles/prompt.css';
import '../styles/userFeedback.css';
import '../styles/tabs.css';

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<Record<string, any[]>>({});
  const [requestDetails, setRequestDetails] = useState<Record<string, any>>({});
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    type: 'positive' | 'negative' | null;
    requestId: string | null;
  }>({ isOpen: false, type: null, requestId: null });

  const [feedbackText, setFeedbackText] = useState<string>('');
  const [submittedFeedback, setSubmittedFeedback] =
    useState<Record<string, 'positive' | 'negative'>>({});

  // Tabs
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const tabs = [
    { id: 'dashboard', label: 'Performance Radar' },
    { id: 'prompt', label: 'Prompt Control' },
    { id: 'feedback', label: 'User Feedback' },
    { id: 'conversations', label: 'Recent Conversations' },
  ];

  // Date filters: default to [today-7, today]
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const [startDate, setStartDate] = useState<string>(formatDate(sevenDaysAgo));
  const [endDate, setEndDate] = useState<string>(formatDate(today));

  // Fetch auth token on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const token = await getAuthToken();
        if (!cancelled) setAuthToken(token);
      } catch (error) {
        if (!cancelled) console.error('Failed to get auth token:', error);
      }
    }

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch sessions when token or dates change
  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;

    async function loadSessions() {
      setIsLoadingSessions(true);
      try {
        const response = await fetchSessions(authToken!, startDate, endDate);
        if (cancelled) return;

        const sess = response.sessions || [];
        setSessions(sess);

        // fetch requests per session
        const reqPromises = sess
          .filter((s: any) => s.sessionId)
          .map((s: any) =>
            fetchSessionRequests(authToken!, s.sessionId, startDate, endDate).catch((e) =>
              console.error(`Failed to fetch requests for session ${s.sessionId}:`, e),
            ),
          );

        const reqResponses = await Promise.all(reqPromises);

        const sessionReqMap: Record<string, any[]> = {};
        const allRequestIds: string[] = [];

        reqResponses.forEach((r, idx) => {
          const sessionId = sess[idx]?.sessionId;
          if (r && r.requests && sessionId) {
            sessionReqMap[sessionId] = r.requests;
            r.requests.forEach((rq: any) => {
              if (rq.requestId || rq.id) allRequestIds.push(rq.requestId || rq.id);
            });
          }
        });

        if (cancelled) return;

        setSessionRequests(sessionReqMap);

        // fetch details for all requests
        if (allRequestIds.length) {
          const detailPromises = allRequestIds.map((rid) =>
            fetchRequestDetail(authToken!, rid).catch((e) =>
              console.error(`Failed to fetch detail for request ${rid}:`, e),
            ),
          );

          const detResponses = await Promise.all(detailPromises);

          const detailMap: Record<string, any> = {};
          detResponses.forEach((dr, idx) => {
            if (dr && dr.request) detailMap[allRequestIds[idx]] = dr.request;
          });

          if (!cancelled) setRequestDetails(detailMap);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch sessions:', error);
          setSessions([]);
        }
      } finally {
        if (!cancelled) setIsLoadingSessions(false);
      }
    }

    loadSessions();
    return () => {
      cancelled = true;
    };
  }, [authToken, startDate, endDate]);

  function signOut() {
    sessionStorage.removeItem('axAccess');
    navigate('/', { replace: true });
  }

  function toggleSessionExpansion(sessionId: string) {
    const next = new Set(expandedSessions);
    if (next.has(sessionId)) next.delete(sessionId);
    else next.add(sessionId);
    setExpandedSessions(next);
  }

  // Feedback handlers
  const handleFeedbackClick = (type: 'positive' | 'negative', requestId: string) => {
    setFeedbackModal({ isOpen: true, type, requestId });
    setFeedbackText('');
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({ isOpen: false, type: null, requestId: null });
    setFeedbackText('');
  };

  const submitFeedback = () => {
    console.log('Feedback submitted:', {
      type: feedbackModal.type,
      requestId: feedbackModal.requestId,
      text: feedbackText,
    });

    if (feedbackModal.requestId && feedbackModal.type) {
      setSubmittedFeedback((prev) => ({
        ...prev,
        [feedbackModal.requestId!]: feedbackModal.type!,
      }));
    }

    closeFeedbackModal();
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">TecAce Ax Pro</div>
        <div className="header-actions">
          <button
            className="icon-btn"
            aria-label="Open settings"
            title="Settings"
            onClick={() => setIsSettingsOpen(true)}
          >
            <IconGear />
          </button>
          <button
            className="icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={signOut}
          >
            <IconLogout />
          </button>
        </div>
      </header>

      <main className="content">
        <div className="tabs-container">
          <div className="tabs-header">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'dashboard' && (
              <div className="tab-panel">
                <MetricRadarChart />
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="tab-panel">
                <PromptControl />
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="tab-panel">
                <UserFeedback />
              </div>
            )}

            {activeTab === 'conversations' && (
              <div className="tab-panel">
                <div className="card section" aria-labelledby="recent-conv-title">
                  <div className="section-header">
                    <div
                      id="recent-conv-title"
                      className="section-title conversations-title"
                    >
                      Recent Conversations
                    </div>
                    <div className="date-controls">
                      <label className="date-field">
                        <span>Start Date</span>
                        <input
                          type="date"
                          className="input date-input"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </label>
                      <label className="date-field">
                        <span>End Date</span>
                        <input
                          type="date"
                          className="input date-input"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="sessions-content">
                    {isLoadingSessions ? (
                      <p className="muted">Loading conversations...</p>
                    ) : sessions.length > 0 ? (
                      <div className="sessions-list">
                        {sessions.map((session, index) => {
                          const sessionId =
                            session.sessionId || session.id || `Session ${index + 1}`;
                          const isExpanded = expandedSessions.has(sessionId);
                          const requests = sessionRequests[sessionId] || [];

                          return (
                            <div key={sessionId} className="session-container">
                              <div
                                className="session-row"
                                onClick={() => toggleSessionExpansion(sessionId)}
                              >
                                <div className="session-left">
                                  <div className="session-id">Session: {sessionId}</div>
                                  <div className="session-messages">
                                    {requests.length === 1
                                      ? '1 message'
                                      : `${requests.length} messages`}
                                  </div>
                                </div>
                                <div className="session-right">
                                  <div className="session-date">
                                    {session.createdAt
                                      ? new Date(session.createdAt).toLocaleDateString()
                                      : 'No date'}
                                  </div>
                                  <div className="session-time">
                                    {session.createdAt
                                      ? new Date(session.createdAt).toLocaleTimeString(
                                          [],
                                          { hour: '2-digit', minute: '2-digit' },
                                        )
                                      : ''}
                                  </div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="requests-container">
                                  {requests.length > 0 ? (
                                    requests.map((request: any, reqIndex: number) => {
                                      const requestId = request.requestId || request.id;
                                      const detail = requestDetails[requestId];

                                      return (
                                        <div
                                          key={requestId || reqIndex}
                                          className="request-item"
                                        >
                                          <div className="request-header">
                                            <div className="request-datetime">
                                              {request.createdAt ? (
                                                <>
                                                  <div className="request-date">
                                                    {new Date(
                                                      request.createdAt,
                                                    ).toLocaleDateString()}
                                                  </div>
                                                  <div className="request-time">
                                                    {new Date(
                                                      request.createdAt,
                                                    ).toLocaleTimeString([], {
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                    })}
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="request-date">
                                                  No date available
                                                </div>
                                              )}
                                            </div>

                                            <div className="request-actions">
                                              <button
                                                className={`thumbs-btn thumbs-up ${
                                                  submittedFeedback[requestId] === 'positive'
                                                    ? 'submitted'
                                                    : ''
                                                }`}
                                                title="Thumbs Up"
                                                onClick={() =>
                                                  handleFeedbackClick('positive', requestId)
                                                }
                                              >
                                                <svg
                                                  fill="currentColor"
                                                  viewBox="0 0 24 24"
                                                  xmlns="http://www.w3.org/2000/svg"
                                                >
                                                  <path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
                                                </svg>
                                              </button>

                                              <button
                                                className={`thumbs-btn thumbs-down ${
                                                  submittedFeedback[requestId] === 'negative'
                                                    ? 'submitted'
                                                    : ''
                                                }`}
                                                title="Thumbs Down"
                                                onClick={() =>
                                                  handleFeedbackClick('negative', requestId)
                                                }
                                              >
                                                <svg
                                                  fill="currentColor"
                                                  viewBox="0 0 24 24"
                                                  xmlns="http://www.w3.org/2000/svg"
                                                >
                                                  <path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
                                                </svg>
                                              </button>
                                            </div>
                                          </div>

                                          {detail && (
                                            <>
                                              <div className="conversation-item user">
                                                <div className="conversation-text">
                                                  {detail.inputText}
                                                </div>
                                              </div>
                                              <div className="conversation-item assistant">
                                                <div className="conversation-text">
                                                  {detail.outputText}
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="muted">
                                      No requests found for this session.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">
                        No conversations found for the selected date range.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {feedbackModal.isOpen && (
        <div className="modal-backdrop" onClick={closeFeedbackModal}>
          <div
            className="modal card feedback-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="h1 modal-title">HR Feedback</h2>
              <button className="icon-btn" onClick={closeFeedbackModal}>
                <IconX />
              </button>
            </div>
            <div className="feedback-content">
              <p className="feedback-prompt">
                {feedbackModal.type === 'positive'
                  ? 'Please explain what was positive about this chat response'
                  : 'Please explain what was negative about this chat response'}
              </p>
              <textarea
                className="feedback-textarea"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Enter your feedback here..."
                rows={4}
              />
              <button
                className="btn submit-feedback-btn"
                onClick={submitFeedback}
                disabled={!feedbackText.trim()}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal card">
            <div className="modal-header">
              <h2 className="h1 modal-title">Settings</h2>
              <button
                className="icon-btn"
                aria-label="Close settings"
                title="Close"
                onClick={() => setIsSettingsOpen(false)}
              >
                <IconX />
              </button>
            </div>
            <div className="muted">Settings content will go here.</div>
          </div>
        </div>
      )}
    </div>
  );
}