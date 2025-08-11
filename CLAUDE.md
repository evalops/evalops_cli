# EvalOps CLI Development Guidelines

## TypeScript Standards

**CRITICAL**: We must NEVER have type `any` anywhere, unless absolutely, positively necessary. 

- Use proper TypeScript types for all variables, parameters, and return types
- When interfacing with external libraries that don't have proper types, create interface definitions
- Use type assertions (`as Type`) rather than `any` when you know the type
- For Tree-sitter and other complex parsing libraries, create proper type definitions

## Code Quality Standards

- All functions must have explicit return types
- All parameters must have explicit types
- Use `const` assertions for literal types
- Prefer interfaces over type aliases for object shapes
- Use utility types (Partial, Pick, Omit) when appropriate

## Testing

- All core functionality must have unit tests
- Use proper mocking for external dependencies
- Test both success and failure cases
- Mock file system operations in tests

## Error Handling

- Always provide meaningful error messages
- Use proper error types and inheritance
- Handle both expected and unexpected errors gracefully
- Log warnings for non-critical failures

## Dependencies

- Minimize external dependencies
- Prefer well-maintained, popular packages
- Always check for security vulnerabilities
- Document any complex dependency choices