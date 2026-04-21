const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID || '';
const COMETCHAT_API_KEY = process.env.COMETCHAT_API_KEY || process.env.COMETCHAT_AUTH_KEY || '';
const COMETCHAT_REGION = process.env.COMETCHAT_REGION || 'us';

const BASE_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3`;

const headers = {
  'Content-Type': 'application/json',
  'apikey': COMETCHAT_API_KEY,
  'appid': COMETCHAT_APP_ID,
};

class CometChatApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'CometChatApiError';
  }
}

const EXPECTED_CODES = new Set([
  'ERR_UID_ALREADY_EXISTS',
  'ERR_ALREADY_EXISTS',
  'ERR_GUID_ALREADY_EXISTS',
  'ERR_ALREADY_JOINED',
]);

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errCode = data?.error?.code || `HTTP_${response.status}`;
    const errMsg = data?.error?.message || data?.message || `CometChat API error ${response.status}`;
    if (!EXPECTED_CODES.has(errCode)) {
      console.error(`CometChat API error [${method} ${path}]:`, JSON.stringify(data));
    }
    throw new CometChatApiError(errMsg, errCode);
  }
  return data;
}

const NO_ACCESS_CODES = new Set([
  'AUTH_ERR_NO_ACCESS',
  'ERR_AUTH_TOKEN_NOT_FOUND',
  'HTTP_401',
  'HTTP_403',
]);

export async function ensureCometChatUser(uid: string, name: string): Promise<void> {
  try {
    await apiCall('POST', '/users', { uid, name });
  } catch (e: any) {
    if (e instanceof CometChatApiError) {
      if (EXPECTED_CODES.has(e.code)) return;
      if (NO_ACCESS_CODES.has(e.code)) {
        console.warn(`CometChat: API key lacks user-creation scope — user ${uid} not synced. Grant "Full Access" in CometChat dashboard.`);
        return;
      }
    }
    console.error(`CometChat: Failed to ensure user ${uid}:`, e.message);
  }
}

export async function ensureCometChatGroup(guid: string, name: string, type: string = 'public'): Promise<void> {
  try {
    await apiCall('POST', '/groups', { guid, name, type });
    return;
  } catch (e: any) {
    if (e instanceof CometChatApiError) {
      if (EXPECTED_CODES.has(e.code)) return;
      if (NO_ACCESS_CODES.has(e.code)) {
        console.warn(`CometChat: API key lacks group-creation scope — group ${guid} not created. Grant "Full Access" in CometChat dashboard.`);
        return;
      }
    }
    console.error(`CometChat: POST /groups failed for ${guid}:`, e.message);
  }

  try {
    await apiCall('GET', `/groups/${guid}`);
  } catch (getErr: any) {
    if (getErr instanceof CometChatApiError && NO_ACCESS_CODES.has(getErr.code)) {
      console.warn(`CometChat: Cannot verify group ${guid} — API key lacks access.`);
      return;
    }
    console.error(`CometChat: Group ${guid} does not exist and could not be created`);
  }
}

export async function addMemberToGroup(groupGuid: string, userUid: string, scope: string = 'participant'): Promise<boolean> {
  try {
    const members = [{ uid: userUid, scope }];
    await apiCall('POST', `/groups/${groupGuid}/members`, { members });
    return true;
  } catch (e: any) {
    if (e instanceof CometChatApiError) {
      if (EXPECTED_CODES.has(e.code) || e.message?.includes('already')) return true;
      if (NO_ACCESS_CODES.has(e.code)) {
        console.warn(`CometChat: API key lacks member-add scope for group ${groupGuid}.`);
        return false;
      }
    }
    console.error(`CometChat: Failed to add user ${userUid} to group ${groupGuid}:`, e.message);
    return false;
  }
}

export async function addMembersToGroupBatch(groupGuid: string, memberUids: Array<{ uid: string; scope?: string }>): Promise<boolean> {
  if (memberUids.length === 0) return true;
  try {
    const members = memberUids.map(m => ({ uid: m.uid, scope: m.scope || 'participant' }));
    await apiCall('POST', `/groups/${groupGuid}/members`, { members });
    return true;
  } catch (e: any) {
    if (e instanceof CometChatApiError && NO_ACCESS_CODES.has(e.code)) {
      console.warn(`CometChat: API key lacks batch member-add scope for group ${groupGuid}.`);
      return false;
    }
    console.error(`CometChat: Batch add to group ${groupGuid} failed:`, e.message);
    return false;
  }
}

export async function getGroupMembers(groupGuid: string): Promise<string[]> {
  try {
    const result = await apiCall('GET', `/groups/${groupGuid}/members?perPage=100`);
    if (result?.data) {
      return result.data.map((m: any) => m.uid);
    }
    return [];
  } catch (e: any) {
    return [];
  }
}

export async function syncAdminDmGroup(
  bubbleId: string,
  bubbleTitle: string,
  memberId: string,
  memberName: string,
  adminUsers: Array<{ id: string; name: string }>
): Promise<{ dmGuid: string; participantIds: string[] }> {
  const dmGuid = `adm_${bubbleId}_${memberId}`;
  const groupName = `${bubbleTitle} : ${memberName}`;

  await ensureCometChatGroup(dmGuid, groupName, 'private');

  await ensureCometChatUser(String(memberId), memberName);
  await addMemberToGroup(dmGuid, String(memberId));

  const participantIds: string[] = [String(memberId)];

  for (const admin of adminUsers) {
    await ensureCometChatUser(String(admin.id), admin.name);
    await addMemberToGroup(dmGuid, String(admin.id), 'admin');
    if (!participantIds.includes(String(admin.id))) {
      participantIds.push(String(admin.id));
    }
  }

  return { dmGuid, participantIds };
}

export async function syncAllAdminDmGroupsForBubble(
  bubbleId: string,
  bubbleTitle: string,
  currentAdminIds: string[],
  allMemberIds: string[],
  getUserName: (id: string) => Promise<string>
): Promise<void> {
  for (const memberId of allMemberIds) {
    if (currentAdminIds.includes(memberId)) continue;

    const dmGuid = `adm_${bubbleId}_${memberId}`;
    try {
      const existingMembers = await getGroupMembers(dmGuid);
      if (existingMembers.length === 0) continue;

      for (const uid of existingMembers) {
        if (uid === String(memberId)) continue;
        if (!currentAdminIds.includes(uid)) {
          await removeMemberFromGroup(dmGuid, uid);
        }
      }

      for (const adminId of currentAdminIds) {
        if (!existingMembers.includes(String(adminId))) {
          const name = await getUserName(adminId);
          await ensureCometChatUser(String(adminId), name);
          await addMemberToGroup(dmGuid, String(adminId), 'admin');
        }
      }
    } catch (e) {
      console.error(`CometChat: Failed to sync admin DM group ${dmGuid}:`, e);
    }
  }
}

export async function generateAuthToken(uid: string): Promise<string> {
  const result = await apiCall('POST', `/users/${uid}/auth_tokens`);
  const token = result?.data?.authToken;
  if (!token) throw new Error(`CometChat: no authToken returned for uid ${uid}`);
  return token;
}

export async function removeMemberFromGroup(groupGuid: string, userUid: string): Promise<boolean> {
  try {
    await apiCall('DELETE', `/groups/${groupGuid}/members/${userUid}`);
    return true;
  } catch (e: any) {
    if (e instanceof CometChatApiError && NO_ACCESS_CODES.has(e.code)) {
      console.warn(`CometChat: API key lacks member-remove scope for group ${groupGuid}.`);
      return false;
    }
    console.error(`CometChat: Failed to remove user ${userUid} from group ${groupGuid}:`, e.message);
    return false;
  }
}
