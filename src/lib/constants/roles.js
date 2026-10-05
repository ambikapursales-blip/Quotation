// Centralized role definitions for the application.
// Keep all role-related constants here to avoid hard-coded strings.

/**
 * Available user roles in the system.
 * Used for type safety and consistency across the codebase.
 */
export const ROLES = {
  ADMIN: "Admin",
  USER: "User",
} as const;

/**
 * Type for role values.
 */
export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Check if a role is valid.
 */
export function isValidRole(role: string): role is Role {
  return Object.values(ROLES).includes(role as Role);
}

/**
 * Default role for new users.
 */
export const DEFAULT_ROLE: Role = ROLES.USER;

/**
 * Role hierarchy (higher number = more permissions).
 * Useful for future permission checks.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.ADMIN]: 100,
  [ROLES.USER]: 10,
};

/**
 * Check if a role has at least the specified minimum role level.
 * @param userRole - The user's role
 * @param minimumRole - The minimum required role
 * @returns true if userRole >= minimumRole
 */
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Get all available roles as an array.
 */
export function getAllRoles(): Role[] {
  return Object.values(ROLES);
}

/**
 * Role display options for UI dropdowns.
 */
export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "Admin" },
  { value: ROLES.USER, label: "User" },
];