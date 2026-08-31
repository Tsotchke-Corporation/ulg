export const SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED = 'disabled';
export const SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW = 'shadow';
export const SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE =
  'authoritative';

export const SCHROEDER_REACTION_ACTIVATION_POLICY_DISABLED =
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED;
export const SCHROEDER_REACTION_ACTIVATION_POLICY_SHADOW =
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW;
export const SCHROEDER_REACTION_ACTIVATION_POLICY_AUTHORITATIVE =
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE;

export const SCHROEDER_DYNAMIC_LAW_ROUTING_POLICIES = Object.freeze([
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_DISABLED,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW,
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_AUTHORITATIVE
]);

// Policy selection remains explicit at the scene boundary. A missing operator
// choice observes the complete authenticated route without changing execution.
export const SCHROEDER_DYNAMIC_LAW_ROUTING_DEFAULT_POLICY =
  SCHROEDER_DYNAMIC_LAW_ROUTING_POLICY_SHADOW;

export function exactSchroederDynamicLawRoutingPolicy(value) {
  return typeof value === 'string'
    && SCHROEDER_DYNAMIC_LAW_ROUTING_POLICIES.includes(value)
      ? value
      : null;
}

export function normalizeSchroederReactionActivationPolicy(
  value,
  fallback = SCHROEDER_REACTION_ACTIVATION_POLICY_SHADOW
) {
  return exactSchroederDynamicLawRoutingPolicy(value)
    ?? exactSchroederDynamicLawRoutingPolicy(fallback)
    ?? SCHROEDER_REACTION_ACTIVATION_POLICY_SHADOW;
}

// These values describe the composite authenticated schedule route. Raw GPU
// watch words and carrier materialization receipts remain evidence and do not
// independently acquire routing authority.
export const SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY = false;
export const SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY = true;
export const SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE =
  'enabled-on-serialized-scene-worker-lane-after-contact-thermo-phase-envelope-schedule-auth-and-1-to-4-carriers';
