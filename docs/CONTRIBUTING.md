# Contributing

Thanks for considering contributing to this project. Here's what you need to know.

## Getting Started

1. Fork the repo
2. Clone your fork
3. Open `index.html` in a browser — that's it, no build step needed

For full functionality you'll need API keys from [ScaleDown](https://scaledown.ai) and [Google AI Studio](https://aistudio.google.com).

## Project Layout

```
Product Manual Assistant/
├── index.html      # UI structure
├── style.css       # All styles, theming, responsive breakpoints
├── script.js       # Application logic
├── favicon.svg     # App icon
└── docs/           # Documentation
```

## Making Changes

### Code Style

Nothing fancy. Just follow what's already there:

- Use `const` and `let`, not `var`
- camelCase for functions and variables
- kebab-case for CSS classes and IDs
- Add comments when the code isn't self-explanatory

### JavaScript

```javascript
// Good: explains why, not what
// Skip compression for short pages since ScaleDown adds overhead
if (page.text.length < 50) {
    compressedPages.push({ page: page.pageNum, text: page.text });
    continue;
}

// Bad: just restates the code
// Check if length is less than 50
if (page.text.length < 50) {
```

### CSS

Group properties logically:

```css
.component {
    /* Layout */
    display: flex;
    
    /* Spacing */
    padding: 16px;
    
    /* Visual */
    background: var(--glass-bg);
    border-radius: var(--card-radius);
    
    /* Animation */
    transition: var(--transition);
}
```

## Testing

Before submitting:

1. Test in at least Chrome and Firefox
2. Check both light and dark themes
3. Try uploading a real PDF
4. Look for console errors

## Submitting Changes

1. Create a branch for your changes
2. Make your commits
3. Push to your fork
4. Open a pull request

Keep PRs focused. One feature or fix per PR is easier to review.

### Commit Messages

Be descriptive but concise:

```
fix: handle password-protected PDFs gracefully
feat: add keyboard shortcuts for annotation tools
docs: clarify API key setup steps
```

## Reporting Bugs

Open an issue with:

- Browser and version
- What you did
- What you expected
- What actually happened
- Console errors if any

## Feature Requests

Open an issue describing:

- What you want
- Why it would be useful
- How you imagine it working

## Questions?

Open an issue. Happy to help.