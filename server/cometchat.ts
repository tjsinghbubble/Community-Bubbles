const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID || '';
const COMETCHAT_AUTH_KEY = process.env.COMETCHAT_AUTH_KEY || '';
const COMETCHAT_REGION = process.env.COMETCHAT_REGION || 'us';

const BASE_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3`;

const headers = {
  'Content-Type': 'application/json',
  'apikey': COMETCHAT_AUTH_KEY,
  'appid': COMETCHAT_APP_ID,
};

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error(`CometChat API error [${method} ${path}]:`, data);
  }
  return data;
}

export async function ensureCometChatUser(uid: string, name: string): Promise<void> {
  try {
    await apiCall('POST', '/users', { uid, name });
  } catch (e: any) {
    // User may already exist
  }
}

export async function ensureCometChatGroup(guid: string, name: string, type: string = 'public'): Promise<void> {
  try {
    await apiCall('POST', '/groups', { guid, name, type });
  } catch (e: any) {
    // Group may already exist
  }
}

export async function addMemberToGroup(groupGuid: string, userUid: string, scope: string = 'participant'): Promise<boolean> {
  try {
    const members = [{ uid: userUid, scope }];
    const result = await apiCall('POST', `/groups/${groupGuid}/members`, { members });
    console.log(`CometChat: Added user ${userUid} to group ${groupGuid}`, result);
    return true;
  } catch (e: any) {
    console.error(`CometChat: Failed to add user ${userUid} to group ${groupGuid}:`, e);
    return false;
  }
}

export async function removeMemberFromGroup(groupGuid: string, userUid: string): Promise<boolean> {
  try {
    const result = await apiCall('DELETE', `/groups/${groupGuid}/members/${userUid}`);
    console.log(`CometChat: Removed user ${userUid} from group ${groupGuid}`, result);
    return true;
  } catch (e: any) {
    console.error(`CometChat: Failed to remove user ${userUid} from group ${groupGuid}:`, e);
    return false;
  }
}
