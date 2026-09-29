let activeConnection: string | null | undefined;
export const getCalendarConnection = () => activeConnection;
export function setCalendarConnection(id: string | null | undefined) {
  activeConnection = id;
}
