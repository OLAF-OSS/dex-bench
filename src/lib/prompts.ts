export const PROMPTS = {
  "analyze-document": (
    document: string,
  ) => `Generate a comprehensive yet concise summary of this document:
<document>${document}</document>

Guidelines:
- Capture the main purpose, key arguments, and conclusions
- Preserve the document's tone and intent
- Include critical details, facts, and figures that are central to understanding
- Maintain logical flow from introduction through conclusion
- Scale summary length appropriately: ~1-2 paragraphs for short docs, ~3-4 for longer ones
- Avoid generic filler phrases; be specific and informative`,
};
