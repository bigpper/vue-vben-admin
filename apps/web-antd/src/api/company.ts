/**
 * Management API client.
 *
 * Every call here goes to the ADMIN routing surface, which the reverse proxy does
 * not expose on the agent-facing host (ADR-0006). The server re-checks the caller's
 * role on every route — the permission codes this app uses only decide what to draw.
 */
import { requestClient } from '#/api/request';

export namespace CompanyApi {
  export interface PolicyRow {
    id: number;
    roleId: null | string;
    document: Record<string, any>;
    version: number;
    active: boolean;
    updatedBy: string;
    createdAt: string;
  }

  export interface AuditRow {
    id: number;
    eventType: string;
    agentMxid: null | string;
    agentCode: null | string;
    roleId: null | string;
    deviceId: null | string;
    conversationId: null | string;
    messageId: null | string;
    targetType: null | string;
    targetId: null | string;
    result: string;
    ipAddress: null | string;
    createdAt: string;
  }

  export interface AuditQuery {
    agentCode?: string;
    conversationId?: string;
    eventType?: string;
    from?: string;
    limit?: number;
    offset?: number;
    result?: string;
    to?: string;
  }

  export interface Customer {
    bridgeToken: string;
    displayAlias: string;
    internalCustomerId: string;
  }
}

export async function listPolicies() {
  return requestClient.get<{ policies: CompanyApi.PolicyRow[] }>(
    '/api/admin/policies',
  );
}

export async function publishPolicy(data: {
  document: Record<string, any>;
  roleId?: null | string;
}) {
  return requestClient.post<{ document: Record<string, any>; version: number }>(
    '/api/admin/policies',
    data,
  );
}

export async function queryAudit(params: CompanyApi.AuditQuery) {
  return requestClient.get<{ events: CompanyApi.AuditRow[]; total: number }>(
    '/api/admin/audit',
    { params },
  );
}

export async function exportAudit(params: CompanyApi.AuditQuery) {
  return requestClient.post<{ csv: string; rows: number }>(
    '/api/admin/audit/export',
    params,
  );
}

export async function listCustomers(params: { limit?: number; q?: string }) {
  return requestClient.get<{ customers: CompanyApi.Customer[] }>(
    '/api/admin/customers',
    { params },
  );
}

/**
 * Reveal a customer's real Telegram identity.
 *
 * Requires `identity:reveal` (Security Administrator). The reason is mandatory —
 * the API refuses without one, so this is not a field the UI can quietly skip.
 * Every call writes an audit record naming the caller and the reason.
 */
export async function revealCustomer(id: string, reason: string) {
  return requestClient.post<{
    displayAlias: string;
    identityOnFile: boolean;
    internalCustomerId: string;
    telegramPhone: null | string;
    telegramUserId: null | string;
    telegramUsername: null | string;
  }>(`/api/admin/customers/${encodeURIComponent(id)}/reveal`, { reason });
}

/**
 * Register customers the bridge knows about but this database has not recorded.
 *
 * Adds internal identifiers only. It cannot discover a Telegram identity — that is
 * not present anywhere on the readable side of the boundary — so a reconciled row
 * always starts with `identityOnFile: false` until an administrator completes it.
 */
export async function reconcileCustomers() {
  return requestClient.post<{
    discovered: number;
    registered: number;
    total: number;
  }>('/api/admin/customers/reconcile');
}

export interface AgentRow {
  active: boolean;
  agentCode: string;
  createdAt: string;
  displayName: null | string;
  mxid: string;
  roleId: string;
}

export interface RoleRow {
  id: string;
  name: string;
  rank: number;
}

export async function listAgents(pending = false) {
  return requestClient.get<{ agents: AgentRow[]; pendingCount: number }>(
    '/api/admin/agents',
    { params: pending ? { pending: 'true' } : {} },
  );
}

export async function listRoles() {
  return requestClient.get<{ roles: RoleRow[] }>('/api/admin/roles');
}

export async function upsertAgent(data: {
  agentCode: string;
  displayName?: string;
  mxid: string;
  roleId: string;
}) {
  return requestClient.post<{ ok: boolean }>('/api/admin/agents', data);
}

export async function setAgentActive(mxid: string, active: boolean) {
  return requestClient.post<{ ok: boolean }>(
    `/api/admin/agents/${encodeURIComponent(mxid)}/active`,
    { active },
  );
}

export async function systemHealth() {
  return requestClient.get<{
    checkedAt: string;
    components: { detail?: string; name: string; status: string }[];
  }>('/api/admin/system/health');
}

export interface ConversationRow {
  /**
   * Telegram account this conversation belongs to.
   *
   * null for group portals: the bridge scopes only direct chats per login
   * (portal.receiver), because a group is shared by every account that is in it.
   */
  account: null | string;
  assignedTo: null | string;
  customerAlias: null | string;
  name: null | string;
  roomId: null | string;
  status: string;
  type: string;
}

export async function listConversations() {
  return requestClient.get<{ conversations: ConversationRow[] }>(
    '/api/admin/conversations',
  );
}

export async function assignConversation(data: {
  agentMxid?: null | string;
  roomId: string;
  status?: string;
}) {
  return requestClient.post<{ ok: boolean }>(
    '/api/admin/conversations/assign',
    data,
  );
}

export async function telegramStatus() {
  return requestClient.get<{
    bridgedIdentities: number;
    logins: { id: string; name: null | string }[];
    portals: { dm: number; group: number; total: number };
    schema: { detail?: string; ok: boolean };
  }>('/api/admin/telegram/status');
}

export interface RoomWidgetConfig {
  label: null | string;
  roomId: string;
  targetUrl: string;
  updatedAt: string;
  updatedBy: string;
}

export async function listRoomWidgets() {
  return requestClient.get<{ configs: RoomWidgetConfig[] }>(
    '/api/admin/room-widgets',
  );
}

/** targetUrl: null clears the configuration for that room. */
export async function setRoomWidget(data: {
  label?: string;
  roomId: string;
  targetUrl: null | string;
}) {
  return requestClient.post<{ ok: boolean }>('/api/admin/room-widgets', data);
}
