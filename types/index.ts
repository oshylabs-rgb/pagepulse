// ── Database Types ──────────────────────────────────────────────

export interface Site {
  id: string
  user_id: string
  url: string
  name: string
  created_at: string
  updated_at: string
}

export interface Audit {
  id: string
  site_id: string
  user_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  overall_score: number | null
  performance_score: number | null
  seo_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  issues: AuditIssue[]
  recommendations: string[]
  raw_data: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

export interface AuditIssue {
  id: string
  category: 'seo' | 'performance' | 'accessibility' | 'best-practices'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  element?: string
  suggestion: string
}

export interface MonitoringAlert {
  id: string
  site_id: string
  user_id: string
  type: 'score_drop' | 'issue_detected' | 'site_down' | 'ssl_expiry'
  message: string
  severity: 'critical' | 'warning' | 'info'
  read: boolean
  created_at: string
}

// ── Subscription / Billing ─────────────────────────────────────

export type PlanTier = 'free' | 'pro' | 'agency'

export interface Subscription {
  id: string
  user_id: string
  plan: PlanTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  current_period_end: string | null
  created_at: string
}

export const PLAN_LIMITS: Record<PlanTier, { sites: number; audits_per_month: number; monitoring: boolean }> = {
  free: { sites: 1, audits_per_month: 3, monitoring: false },
  pro: { sites: 5, audits_per_month: 50, monitoring: true },
  agency: { sites: 25, audits_per_month: 500, monitoring: true },
}

// ── API Types ──────────────────────────────────────────────────

export interface AuditRequest {
  site_id: string
  url: string
}

export interface AuditResponse {
  audit_id: string
  status: Audit['status']
}
