# Contributing to SkalX AI

We welcome contributions! Please follow these guidelines to ensure a smooth collaboration.

---

## Development Workflow

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/OptimX---Beta.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

4. **Test your changes**
   ```bash
   # Run type checking
   npx tsc --noEmit
   
   # Run linter
   npm run lint
   
   # Test locally
   npm run dev
   ```

5. **Commit with descriptive message**
   ```bash
   git add .
   git commit -m "feat: add Instagram story publishing"
   # or
   git commit -m "fix: resolve OAuth redirect issue"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in PR template with details

---

## Code Style

### TypeScript
- Use strict typing, avoid `any` when possible
- Define interfaces for complex objects
- Use type inference where obvious

### Components
- Functional components with hooks (no class components)
- Use React Hook Form for forms
- Leverage Radix UI components for accessibility

### Naming Conventions
- `camelCase` for variables and functions
- `PascalCase` for React components
- `UPPER_SNAKE_CASE` for constants
- Descriptive names (avoid abbreviations)

### File Organization
- One component per file
- Group related components in folders
- Keep files under 300 lines when possible

### Formatting
- Prettier with default settings
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in multiline

---

## Pull Request Guidelines

### PR Title Format
```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: improve code structure
test: add tests
chore: update dependencies
```

### PR Description Should Include
- Summary of changes
- Related issue number (if applicable)
- Testing performed
- Screenshots (for UI changes)
- Breaking changes (if any)

### Code Review Process
1. Automated checks must pass (linting, type checking)
2. At least one approval required
3. Address review comments
4. Squash commits before merging (if requested)

---

## Testing

### Manual Testing
- Test all affected features locally
- Verify on multiple browsers (Chrome, Firefox, Safari)
- Check responsive design (mobile, tablet, desktop)
- Test OAuth flows end-to-end

### Future: Automated Testing
- Unit tests for utility functions
- Integration tests for API endpoints
- E2E tests for critical user flows

---

## Documentation

- Update README.md if adding major features
- Add JSDoc comments for public functions
- Update relevant `/docs` files
- Include code examples where helpful

---

## Questions?

- Check existing issues and discussions
- Ask in pull request comments
- Reach out via email: tech.optimx@gmail.com

---

**See also:** [Development Guide](./DEVELOPMENT.md) | [Architecture](./ARCHITECTURE.md)
