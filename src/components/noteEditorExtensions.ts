import { Extension } from "@tiptap/core";

// Custom FontSize extension (TipTap 3 TextStyle attribute)
export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({
          chain,
        }: {
          chain: () => { setMark: (...a: unknown[]) => { run: () => boolean }; run: () => boolean };
        }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({
          chain,
        }: {
          chain: () => {
            setMark: (...a: unknown[]) => { removeEmptyTextStyle: () => { run: () => boolean } };
            run: () => boolean;
          };
        }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
