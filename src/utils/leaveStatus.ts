export function leaveStatusDescription(status: string, effectiveStatus: string | null): string {
  if (status === 'CANCEL_REQUESTED') {
    if (effectiveStatus === 'PENDING') return 'Yêu cầu hủy đang chờ HR duyệt. Đơn nghỉ ban đầu chưa được duyệt.';
    if (effectiveStatus === 'APPROVED') return 'Yêu cầu hủy đang chờ HR duyệt. Đơn nghỉ đã được duyệt vẫn có hiệu lực trong lúc chờ.';
    return 'Yêu cầu hủy đang chờ HR duyệt. Vui lòng kiểm tra trạng thái đơn nghỉ ban đầu.';
  }
  if (status === 'CANCEL_REJECTED') {
    if (effectiveStatus === 'PENDING') return 'HR đã từ chối yêu cầu hủy. Đơn nghỉ ban đầu vẫn chờ duyệt.';
    if (effectiveStatus === 'APPROVED') return 'HR đã từ chối yêu cầu hủy. Đơn nghỉ đã duyệt vẫn có hiệu lực.';
    return 'HR đã từ chối yêu cầu hủy. Vui lòng kiểm tra trạng thái đơn nghỉ ban đầu.';
  }
  return '';
}
