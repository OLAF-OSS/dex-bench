import { countTokens as countTokensFn } from "gpt-tokenizer/encoding/cl100k_base";

export function countTokens(text: string) {
  return countTokensFn(text);
}
