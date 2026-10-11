import { dismissPeoplePickerAction } from '@/features/crush/pickerDismiss';

/**
 * Same pop the stack router uses: `source` is the route to remove, not the focused one.
 * See StackRouter POP when `action.source` is set.
 */
function popRoute(state: { index: number; routes: { name: string }[] }, sourceIndex: number) {
  const count = Math.max(sourceIndex - 1 + 1, 1);
  const routes = state.routes.slice(0, count).concat(state.routes.slice(sourceIndex + 1));
  return { routes, index: routes.length - 1 };
}

test('closing the people picker leaves the match screen focused', () => {
  const state = {
    key: 'stack-1',
    index: 2,
    routes: [
      { key: 'main', name: 'Main' },
      { key: 'picker', name: 'SecretPeoplePicker' },
      { key: 'match', name: 'MatchCelebration' },
    ],
  };
  const action = dismissPeoplePickerAction(state);
  expect(action).toEqual({ type: 'GO_BACK', source: 'picker', target: 'stack-1' });

  const sourceIndex = state.routes.findIndex(r => r.key === action?.source);
  const next = popRoute(state, sourceIndex);
  expect(next.routes.map(r => r.name)).toEqual(['Main', 'MatchCelebration']);
  expect(next.routes[next.index]?.name).toBe('MatchCelebration');
});

test('a plain goBack pops the focused match screen instead', () => {
  const state = {
    index: 2,
    routes: [
      { name: 'Main' },
      { name: 'SecretPeoplePicker' },
      { name: 'MatchCelebration' },
    ],
  };
  const next = popRoute(state, state.index);
  expect(next.routes.map(r => r.name)).toEqual(['Main', 'SecretPeoplePicker']);
});

test('there is nothing to close when the picker is not open', () => {
  expect(
    dismissPeoplePickerAction({
      key: 'stack-1',
      routes: [{ key: 'match', name: 'MatchCelebration' }],
    }),
  ).toBeNull();
});
