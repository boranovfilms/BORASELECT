# Security Specification - BORA SELECT

## Data Invariants
1. A Project must have an `ownerId` that matches the authenticated user.
2. Only the owner can manage `GalleryConfig`, `MediaItem`, and `ClientAccess` for their projects.
3. Client-specific access levels must be enforced (e.g., if a user is a client, they can only view and select media for THEIR project).
4. Timestamps (`createdAt`, `updatedAt`, `uploadedAt`) must be server-generated.

## The Eight Pillars of Hardened Rules

1. **Master Gate**: Access to subcollections (galleries, media, access) is derived from the project owner.
2. **Validation Blueprints**: Strict schema validation for each entity.
3. **Path Variable Hardening**: `isValidId()` check for all document IDs.
4. **Tiered Identity**: Owner vs. Client roles.
5. **Total Array Guarding**: Validating permissions array size.
6. **PII Isolation**: Client email and password (if stored) are protected.
7. **The Atomicity Guarantee**: Relational writes are validated.
8. **Secure List Queries**: Queries must be filtered by owner/relation.

## Access Logic
- **Authenticated Owner**: Full read/write on their own projects.
- **Client**: Read access to their project's gallery and media. Write access to `isSelected` field on `MediaItem`.
