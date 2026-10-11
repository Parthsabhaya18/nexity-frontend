type StackSnapshot = {
  key: string;
  routes: { key: string; name: string }[];
};

/**
 * Closes the people picker without touching the screen on top.
 * A plain goBack pops the focused route. Once the match screen is focused, that dismisses the match.
 */
export function dismissPeoplePickerAction(state: StackSnapshot | undefined) {
  const picker = state?.routes.find(r => r.name === 'SecretPeoplePicker');
  if (!picker || !state) return null;
  return {
    type: 'GO_BACK' as const,
    source: picker.key,
    target: state.key,
  };
}
