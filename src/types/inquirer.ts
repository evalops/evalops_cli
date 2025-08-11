export interface InquirerPrompt {
  type: 'input' | 'list' | 'checkbox' | 'confirm';
  name: string;
  message: string;
  default?: string | boolean | string[];
  choices?: Array<{name: string; value: string; checked?: boolean}>;
  validate?: (input: string) => boolean | string;
  when?: (answers: Record<string, unknown>) => boolean;
}

export interface InquirerAnswers {
  description: string;
  version: string;
  systemPrompt: string;
  userPrompt: string;
  providers: string[];
  customProvider?: string;
  addDefaultAsserts: boolean;
  defaultAsserts?: string[];
}