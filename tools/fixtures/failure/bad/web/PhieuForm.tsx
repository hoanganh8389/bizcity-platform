export function PhieuForm({ v }: { v: any }) {
  return (<form><input type="date" value={v.docDate} /><ItemPicker value={v.itemId} /></form>);
}
