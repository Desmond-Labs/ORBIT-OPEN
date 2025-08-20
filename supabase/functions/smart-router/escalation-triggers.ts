// Escalation Triggers - Automatic Tier 1 to Tier 2 promotion logic
// Monitors Tier 1 performance and triggers escalation when needed

export interface EscalationTrigger {
  name: string;
  condition: (context: EscalationContext) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'monitor' | 'warn' | 'escalate' | 'emergency';
  cooldownMs: number;
}

export interface EscalationContext {
  orderId: string;
  tier1Attempts: number;
  tier1Failures: number;
  totalDuration: number;
  errorTypes: string[];
  systemLoad: number;
  isRetry: boolean;
  userTier: string;
}

export interface EscalationResult {
  shouldEscalate: boolean;
  reason: string;
  triggeredBy: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

// Define escalation triggers
export const ESCALATION_TRIGGERS: EscalationTrigger[] = [
  {
    name: 'repeated_failures',
    condition: (ctx) => ctx.tier1Failures >= 2,
    severity: 'high',
    action: 'escalate',
    cooldownMs: 0
  },
  {
    name: 'timeout_exceeded',
    condition: (ctx) => ctx.totalDuration > 30000, // 30 seconds
    severity: 'medium',
    action: 'escalate',
    cooldownMs: 5000
  },
  {
    name: 'critical_error_pattern',
    condition: (ctx) => ctx.errorTypes.some(error => 
      error.includes('DEPLOYMENT_SYNC_ERROR') || 
      error.includes('DATABASE_ERROR') ||
      error.includes('STORAGE_ACCESS_ERROR')
    ),
    severity: 'high',
    action: 'escalate',
    cooldownMs: 0
  },
  {
    name: 'system_overload',
    condition: (ctx) => ctx.systemLoad > 0.8,
    severity: 'medium',
    action: 'escalate',
    cooldownMs: 10000
  },
  {
    name: 'premium_user_timeout',
    condition: (ctx) => ctx.userTier === 'premium' && ctx.totalDuration > 20000,
    severity: 'medium',
    action: 'escalate',
    cooldownMs: 0
  },
  {
    name: 'enterprise_user_any_failure',
    condition: (ctx) => ctx.userTier === 'enterprise' && ctx.tier1Failures > 0,
    severity: 'high',
    action: 'escalate',
    cooldownMs: 0
  },
  {
    name: 'retry_loop_detected',
    condition: (ctx) => ctx.tier1Attempts >= 3 && ctx.isRetry,
    severity: 'critical',
    action: 'emergency',
    cooldownMs: 0
  }
];

// Cooldown tracking
const triggerCooldowns = new Map<string, number>();

// Check if escalation is needed
export function checkEscalationTriggers(context: EscalationContext): EscalationResult {
  const now = Date.now();
  const triggeredTriggers: string[] = [];
  let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let shouldEscalate = false;
  
  for (const trigger of ESCALATION_TRIGGERS) {
    // Check cooldown
    const lastTriggered = triggerCooldowns.get(trigger.name) || 0;
    if (now - lastTriggered < trigger.cooldownMs) {
      continue;
    }
    
    // Check condition
    if (trigger.condition(context)) {
      triggeredTriggers.push(trigger.name);
      
      // Update severity
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severityLevels[trigger.severity] > severityLevels[maxSeverity]) {
        maxSeverity = trigger.severity;
      }
      
      // Check if escalation is needed
      if (trigger.action === 'escalate' || trigger.action === 'emergency') {
        shouldEscalate = true;
        triggerCooldowns.set(trigger.name, now);
      }
    }
  }
  
  const reason = triggeredTriggers.length > 0 
    ? `Triggered: ${triggeredTriggers.join(', ')}`
    : 'No escalation triggers activated';
  
  const recommendedAction = shouldEscalate
    ? maxSeverity === 'critical' 
      ? 'Emergency escalation to Tier 2 with priority handling'
      : `Escalate to Tier 2 (${maxSeverity} severity)`
    : 'Continue with current tier';
  
  return {
    shouldEscalate,
    reason,
    triggeredBy: triggeredTriggers,
    severity: maxSeverity,
    recommendedAction
  };
}

// Performance monitoring for escalation decisions
export interface PerformanceMetrics {
  tier1SuccessRate: number;
  tier1AverageTime: number;
  tier2SuccessRate: number;
  tier2AverageTime: number;
  systemLoad: number;
  errorRate: number;
}

export function calculateSystemLoad(): number {
  // In a real implementation, this would check:
  // - CPU usage
  // - Memory usage
  // - Active connections
  // - Queue depths
  
  // For now, return a mock value
  return Math.random() * 0.5; // 0-50% load
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return {
    tier1SuccessRate: 0.85, // 85% success rate
    tier1AverageTime: 6500,  // 6.5 seconds average
    tier2SuccessRate: 0.95,  // 95% success rate  
    tier2AverageTime: 13500, // 13.5 seconds average
    systemLoad: calculateSystemLoad(),
    errorRate: 0.15 // 15% error rate
  };
}