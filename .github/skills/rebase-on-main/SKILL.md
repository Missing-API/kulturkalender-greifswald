---
name: rebase-on-main
description: Update main/master from origin, rebase the current branch on it, resolve conflicts, and push.
---

# Rebase on Main

Update main/master from origin, rebase the current branch on it, resolve conflicts, and push.

## Steps

- **Identify the main branch:** Check if main or master exists as the default branch.
- **Save current branch name:** Store the current branch name for later.
- **Fetch latest from origin:** Run git fetch origin.
- **Update main/master locally:** Checkout main/master and pull latest changes.
- **Return to feature branch:** Checkout the original branch.
- **Rebase on main/master:** Run git rebase main (or master).
- **Handle conflicts if any:**
  - If conflicts occur, analyze each conflicting file.
  - Read the conflicting files to understand the context.
  - Resolve conflicts intelligently by understanding both changes.
  - Use git add to mark resolved files.
  - Continue rebase with git rebase --continue.
  - Repeat until all conflicts are resolved.
- **Push changes:** Force push with lease using git push --force-with-lease.

## Important Guidelines

- Always use --force-with-lease instead of --force for safety.
- When resolving conflicts, prefer keeping functionality from both sides when possible.
- If a conflict resolution is ambiguous, explain the choice made.
- Report a summary of what was done at the end (commits rebased, conflicts resolved, etc.).
