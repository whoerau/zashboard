type TextContentTarget = {
  textContent: string | null
}

export const setTextContent = (target: TextContentTarget, value: string) => {
  target.textContent = value
}
