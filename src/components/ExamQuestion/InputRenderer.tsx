import dynamic from "next/dynamic";
import { InputRendererProps } from "./types";

// Lazy load question type components with loading states
const TrueFalseInput = dynamic(() => import("./inputs/TrueFalseInput"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-20 rounded-lg"></div>,
});

const SingleChoiceInput = dynamic(() => import("./inputs/SingleChoiceInput"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-32 rounded-lg"></div>,
});

const MultiSelectInput = dynamic(() => import("./inputs/MultiSelectInput"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-32 rounded-lg"></div>,
});

const ParagraphInput = dynamic(() => import("./inputs/ParagraphInput"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-40 rounded-lg"></div>,
});

export default function InputRenderer({
  type,
  q,
  value,
  onChange,
  disabled,
  legendId
}: InputRendererProps) {
  switch (type) {
    case "true_false": {
      // Don't convert to Boolean - keep null/undefined as no selection
      const v = value as boolean | null | undefined;
      return (
        <TrueFalseInput
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    case "single_choice": {
      const opts = (q.options as string[] | null) ?? [];
      const v = (value as string) ?? "";
      return (
        <SingleChoiceInput
          options={opts}
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
          optionImageUrls={q.option_image_urls || null}
        />
      );
    }
    case "multiple_choice":
    case "multi_select": {
      const opts = (q.options as string[] | null) ?? [];
      const v = Array.isArray(value) ? (value as string[]) : [];
      return (
        <MultiSelectInput
          options={opts}
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
          optionImageUrls={q.option_image_urls || null}
        />
      );
    }
    case "paragraph": {
      const v = (value as string) ?? "";
      return (
        <ParagraphInput
          value={v}
          onChange={(val) => onChange(val)}
          disabled={disabled}
          required={q.required}
          id={legendId}
          legendId={legendId}
        />
      );
    }
    default:
      return <div>Unsupported question type</div>;
  }
}