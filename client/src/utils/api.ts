import { BrainSession, ChatMessage } from '../types';

export const API_BASE = '';

/**
 * Default sample sessions matching the reference design
 */
export const DEFAULT_SESSIONS: BrainSession[] = [
  {
    id: 's-1',
    title: 'Computer Vision Pipeline',
    summary: 'Analyzed 3 images • Generated code',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    category: 'Today',
    icon: 'camera',
  },
  {
    id: 's-2',
    title: 'Posture Analysis',
    summary: '30s observation • JSON output',
    createdAt: Date.now() - 3600000 * 3,
    updatedAt: Date.now() - 3600000 * 3,
    category: 'Today',
    icon: 'activity',
  },
  {
    id: 's-3',
    title: 'EduForge Development',
    summary: 'Next.js • Database schema',
    createdAt: Date.now() - 3600000 * 4,
    updatedAt: Date.now() - 3600000 * 4,
    category: 'Today',
    icon: 'code',
  },
  {
    id: 's-4',
    title: 'YOLO Cancer Training',
    summary: 'Training results • Visualization',
    createdAt: Date.now() - 3600000 * 6,
    updatedAt: Date.now() - 3600000 * 6,
    category: 'Today',
    icon: 'chart',
  },
  {
    id: 's-5',
    title: 'Resume Optimization',
    summary: 'Updated for AI Engineering role',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    category: 'Yesterday',
    icon: 'file',
  },
  {
    id: 's-6',
    title: 'Solar Dryer Dashboard',
    summary: 'ESP32 integration • Web UI',
    createdAt: Date.now() - 86400000 - 3600000 * 4,
    updatedAt: Date.now() - 86400000 - 3600000 * 4,
    category: 'Yesterday',
    icon: 'monitor',
  },
  {
    id: 's-7',
    title: 'Quillora Global Strategy',
    summary: 'Marketing plan • Content ideas',
    createdAt: Date.now() - 86400000 - 3600000 * 7,
    updatedAt: Date.now() - 86400000 - 3600000 * 7,
    category: 'Yesterday',
    icon: 'target',
  },
  {
    id: 's-8',
    title: 'JANUARY UI/UX Design',
    summary: 'Generated interface concepts',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3,
    category: 'Previous 7 Days',
    icon: 'palette',
  },
  {
    id: 's-9',
    title: 'InQuote Desktop App',
    summary: 'Electron • SQLite • Build setup',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5,
    category: 'Previous 7 Days',
    icon: 'database',
  },
];

export async function fetchSessions(): Promise<BrainSession[]> {
  try {
    const res = await fetch(`${API_BASE}/api/brain/sessions?limit=50`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sessions) && data.sessions.length > 0) {
        return data.sessions.map((s: any) => {
          const updatedDate = new Date(s.updatedAt || s.createdAt);
          const now = new Date();
          const diffHours = (now.getTime() - updatedDate.getTime()) / (1000 * 3600);

          let category: 'Today' | 'Yesterday' | 'Previous 7 Days' = 'Today';
          if (diffHours > 48) category = 'Previous 7 Days';
          else if (diffHours > 24) category = 'Yesterday';

          return {
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messageCount: s.messageCount || 0,
            summary: s.summary || `${s.messageCount || 0} messages`,
            category,
            icon: s.icon || 'code',
          };
        });
      }
    }
  } catch (err) {
    console.warn('[API] Could not fetch sessions from server, using sample list:', err);
  }
  return DEFAULT_SESSIONS;
}

export async function createSession(title: string): Promise<BrainSession> {
  try {
    const res = await fetch(`${API_BASE}/api/brain/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.session.id,
        title: data.session.title,
        createdAt: data.session.createdAt,
        updatedAt: data.session.updatedAt,
        category: 'Today',
        icon: 'code',
      };
    }
  } catch (err) {
    console.warn('[API] Failed to create session via server:', err);
  }
  return {
    id: `session-${Date.now()}`,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'Today',
    icon: 'code',
  };
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`${API_BASE}/api/brain/sessions/${sessionId}/messages`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        return data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          source: m.source || 'text',
          text: m.content || m.text,
          timestamp: m.timestamp || m.createdAt || Date.now(),
          isStreaming: false,
        }));
      }
    }
  } catch (err) {
    console.warn('[API] Failed to fetch session messages:', err);
  }
  return [];
}

export async function toggleCameraEyes(action?: 'open' | 'close', fps = 60): Promise<any> {
  const res = await fetch(`${API_BASE}/api/camera/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, fps }),
  });
  return res.json();
}

export async function uploadAttachment(file: File, sessionId?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch(`${API_BASE}/api/brain/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            sessionId,
          }),
        });
        const data = await res.json();
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function deleteSessionApi(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/brain/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('[API] Failed to delete session:', err);
    return false;
  }
}
