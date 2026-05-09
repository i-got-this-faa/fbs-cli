## general guidelines:

- use bun for the package manager
- when installing new packages, use bun add instead of manually editing the package.json file
- dont build the project locally or create dev environment.
- dont mix logic with ui components, keep them separate
- avoid as any at all costs, try to infer types from functions as much as possible
- run bun run lint to check for linting errors, bun run format, and bun run check to check for errors after making changes.
- dont write monolithic files, break them down into smaller, reusable pieces
- use components for UI

## Before You Start Coding

### Ask Yourself:

1. **Does this already exist?**
   - Search the codebase for similar functionality
   - Check if there's an existing utility or component that can be reused
   - If it does exist, consider if it can be extended or if you can use it as is
   
2. **Can I extend something existing?**
   - Maybe a utility just needs one more function
   - Maybe a component just needs one more prop
   - If you can extend something, do it instead of creating a new one
  
3. **Where should this live?**
   - Is it reusable? → Put in `utils/`
   - Is it specific to one feature? → Keep it local
   - Is it a constant? → Put in config

4. **Am I duplicating anything?**
   - If you're copying code, stop and extract it
   - If you're defining the same type twice, use the existing one
   - If you're writing the same logic in multiple places, extract it into a function
  
5. **Is this function doing too much?**
   - Can you describe it in one sentence without "and"?
   - If not, break it down
   - Each function should have a single responsibility
  
6. **Is this a UI component or logic?**
   - If it's rendering something, it's a component
   - If it's processing data, it's logic
   - Keep them separate for clarity and reusability
  