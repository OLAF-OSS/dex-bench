export const PROMPTS = {
  "summarize-document": (
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

  "extract-entities": (
    document: string,
    entityTypes: string[],
  ) => `Extract all instances of the following entity types from the document: ${entityTypes.join(", ")}

Rules for extractions:
- Each extraction must have a unique id (e.g., e1, e2, e3).
- extractionClass must be UPPER_SNAKE_CASE and the most specific applicable type (e.g., EMAIL_ADDRESS over URL; FULL_NAME over NAME).
- extractionText must be an exact copy of characters from the document (preserve casing, accents, spacing; do not normalize).
- Produce a separate item for each occurrence (duplicates share the same start index and should not be repeated).
- Avoid overlapping spans. If two candidates overlap, keep the most specific class.
- Handle multilingual cues (e.g., "E-Mail:", "courriel:", "correo:", "email:", "mail:").
- Include relevant attributes when applicable (e.g., role, type, currency, brand).

Rules for relationships:
- Identify relationships between extracted entities based on context in the document.
- relationshipType must be UPPER_SNAKE_CASE (e.g., WORKS_FOR, LOCATED_IN, OWNS, MANAGES, PART_OF, MEMBER_OF, CREATED_BY, ASSOCIATED_WITH).
- Use sourceId and targetId to reference the entity ids.
- Only include relationships that are explicitly stated or strongly implied in the document.
- Add a description when the relationship needs clarification.

If no entities are found, return {"extractions": [], "relationships": []}.
If entities are found but no relationships exist, return {"extractions": [...], "relationships": []}.

Document to extract from:
<document>${document}</document>`,

  // generate entity types prompt
  "generate-entity-types": (document: string, count = 20) => {
    return `Identify ALL distinct entity types present in this document. This is not limited to common types - extract every category of named entity you can find.

Return ONLY the ${count} most important entity types. If there are fewer than ${count}, return them all.

Examples of entity types (non-exhaustive): PERSON, ORGANIZATION, LOCATION, DATE, TIME, EMAIL_ADDRESS, PHONE_NUMBER, URL, IP_ADDRESS, MONEY, PERCENTAGE, PRODUCT, EVENT, JOB_TITLE, COMPANY, ADDRESS, COUNTRY, CITY, LANGUAGE, TECHNOLOGY, SOFTWARE, HARDWARE, MEDICAL_TERM, LEGAL_TERM, BRAND, PUBLICATION, ARTWORK, VEHICLE, ANIMAL, PLANT, CHEMICAL, MEASUREMENT, COORDINATE, HASHTAG, USERNAME, LICENSE_PLATE, SERIAL_NUMBER, CREDIT_CARD, BANK_ACCOUNT, SSN, PASSPORT_NUMBER, etc.

Document to extract from:
<document>${document}</document>

Rules:
- Be comprehensive: identify ALL entity types that appear in the document, not just common ones
- Only output the ${count} most important types, ordered by significance to the document's content
- Return only the entity TYPE names, not the actual entity values
- Use UPPER_SNAKE_CASE format (e.g., EMAIL_ADDRESS, PHONE_NUMBER)
- Be specific: prefer specific types (CREDIT_CARD) over generic ones (NUMBER)
- Include domain-specific entity types relevant to the document's context`;
  },
};
