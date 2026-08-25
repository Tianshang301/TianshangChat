import type {
  ConversationListResponse,
  GroupDetail,
  GroupSummary,
  HistoryResponse,
  MessageDTO,
  SyncResponse,
} from '@tianshangchat/shared';

/**
 * Thin typed REST layer. Base URL is mutable so the LAN/IP switch
 * (Android settings) takes effect without a reload.
 */
let baseUrl = '';

export function setApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export const api = {
  async history(token: string, days = 7, limit = 500): Promise<MessageDTO[]> {
    const res = await fetch(`${baseUrl}/api/messages/history?days=${days}&limit=${limit}`, {
      headers: authHeaders(token),
    });
    const data = await parse<HistoryResponse>(res);
    return data.success ? data.messages : [];
  },

  async privateHistory(
    token: string,
    peerId: number,
    days = 30,
    limit = 100,
  ): Promise<MessageDTO[]> {
    const res = await fetch(
      `${baseUrl}/api/messages/private/${peerId}?days=${days}&limit=${limit}`,
      { headers: authHeaders(token) },
    );
    const data = await parse<HistoryResponse>(res);
    return data.success ? data.messages : [];
  },

  async groupHistory(
    token: string,
    groupId: number,
    days = 30,
    limit = 500,
  ): Promise<MessageDTO[]> {
    const res = await fetch(`${baseUrl}/api/groups/${groupId}/messages?days=${days}&limit=${limit}`, {
      headers: authHeaders(token),
    });
    const data = await parse<HistoryResponse>(res);
    return data.success ? data.messages : [];
  },

  async privateConversations(token: string): Promise<ConversationListResponse['conversations']> {
    const res = await fetch(`${baseUrl}/api/messages/private-list`, {
      headers: authHeaders(token),
    });
    const data = await parse<ConversationListResponse>(res);
    return data.success ? data.conversations : [];
  },

  async sync(token: string, cursor: number, limit = 200): Promise<SyncResponse> {
    const res = await fetch(`${baseUrl}/api/sync?cursor=${cursor}&limit=${limit}`, {
      headers: authHeaders(token),
    });
    return parse<SyncResponse>(res);
  },

  async groups(token: string): Promise<GroupSummary[]> {
    const res = await fetch(`${baseUrl}/api/groups`, { headers: authHeaders(token) });
    const data = (await res.json()) as { success?: boolean; groups?: GroupSummary[] };
    return data.groups ?? [];
  },

  async groupDetail(token: string, groupId: number): Promise<GroupDetail | null> {
    const res = await fetch(`${baseUrl}/api/groups/${groupId}`, { headers: authHeaders(token) });
    const data = (await res.json()) as { success?: boolean; group?: GroupDetail };
    return data.group ?? null;
  },

  async addMember(token: string, groupId: number, userId: number): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  },

  async removeMember(token: string, groupId: number, userId: number): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async setAdmin(token: string, groupId: number, userId: number, isAdmin: boolean): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}/admin/${userId}`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin }),
    });
  },

  async transferOwner(token: string, groupId: number, newOwnerId: number): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}/transfer`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId }),
    });
  },

  async leaveGroup(token: string, groupId: number): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}/leave`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  async deleteGroup(token: string, groupId: number): Promise<void> {
    await fetch(`${baseUrl}/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async publishBundle(
    token: string,
    bundle: { ikPub: string; edPub: string; spkPub: string; spkSig: string },
  ): Promise<void> {
    await fetch(`${baseUrl}/api/e2ee/bundle`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle),
    });
  },

  async fetchBundle(token: string, userId: number): Promise<{
    bundle: { ikPub: string; edPub: string; spkPub: string; spkSig: string };
  }> {
    const res = await fetch(`${baseUrl}/api/e2ee/bundle/${userId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(`bundle fetch failed (${res.status})`);
    return parse<{
      success: boolean;
      bundle: { ikPub: string; edPub: string; spkPub: string; spkSig: string };
    }>(res);
  },
};
