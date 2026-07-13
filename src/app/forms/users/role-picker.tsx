'use client';

import type { InvitableRole } from '@/lib/user-roles';
import { INVITABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/user-roles';

interface RolePickerProps {
  name: string;
  value: InvitableRole;
  onChange: (role: InvitableRole) => void;
  disabled?: boolean;
}

export function RolePicker({ name, value, onChange, disabled = false }: RolePickerProps) {
  return (
    <fieldset className="users-role-fieldset">
      <legend className="settings-label">Role</legend>
      {INVITABLE_ROLES.map((option) => (
        <label key={option} className="users-role-option">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            disabled={disabled}
          />
          <span className="users-role-option-copy">
            <span className="users-role-option-title">{ROLE_LABELS[option]}</span>
            <span className="users-role-option-desc">{ROLE_DESCRIPTIONS[option]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
