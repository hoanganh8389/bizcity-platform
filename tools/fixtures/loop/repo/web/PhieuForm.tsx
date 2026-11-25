// form mẫu: ô ngày, nhà cung cấp, dòng hàng, kho
export function PhieuForm({ v }: { v: any }) {
  return (<form>
    <input className="input" type="date" value={v.docDate} />
    <PartnerPicker kind="supplier" value={v.partnerCode} addKind="supplier" />
    {v.lines.map((l: any) => (<div>
      <ItemPicker canAdd value={l.itemId} />
      <ListPicker items={[]} value={l.warehouseCode} />
      <NumInput value={l.qty} />
    </div>))}
  </form>);
}
