import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  Search, Eye, Filter, RefreshCw, Check, X, MapPin, Camera, UserCheck
} from 'lucide-react';
import { api } from '../../api';
import Modal from '../ui/Modal';
import { toast } from '../ui/Toast';

export default function AdminPendingReviewView({
  onBack,
  onStudentReviewed
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'face' | 'location'
  const [actionLoading, setActionLoading] = useState(null); // id of record being approved/rejected
  const [selectedReviewModal, setSelectedReviewModal] = useState(null);
  const [remarks, setRemarks] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminPendingReviews();
      setReviews(data.pending_reviews || []);
    } catch (err) {
      console.error('Failed to load pending reviews:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleAction = async (review, action) => {
    if (!review?.session_id || !review?.roll_no) {
      toast.warning('Cannot perform review action: missing session ID or student roll number.');
      return;
    }
    const normalizedAction = action.toUpperCase().startsWith('APP') ? 'APPROVE' : 'REJECT';
    setActionLoading(review.id);
    try {
      await api.facultyApprove({
        session_id: review.session_id,
        roll_no: review.roll_no,
        action: normalizedAction, // strictly 'APPROVE' or 'REJECT' as expected by backend
        remarks: remarks.trim() || `Administrative review decision: ${normalizedAction === 'APPROVE' ? 'Approved by Admin' : 'Rejected by Admin'}`
      });
      // Remove from local list only on verified success
      setReviews(prev => prev.filter(r => r.id !== review.id));
      setSelectedReviewModal(null);
      setRemarks('');
      toast.success(`Record ${normalizedAction === 'APPROVE' ? 'approved' : 'rejected'} successfully.`);
      if (onStudentReviewed) onStudentReviewed();
    } catch (err) {
      toast.error(`Review action failed: ${err.message || 'Server error occurred during verification'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter categorization
  const faceMismatchReviews = reviews.filter(r =>
    (r.flag_reason || '').toLowerCase().includes('face') ||
    (r.flag_reason || '').toLowerCase().includes('confidence') ||
    (r.flag_reason || '').toLowerCase().includes('blink') ||
    (r.face_status === 'MISMATCH')
  );

  const locationReviews = reviews.filter(r =>
    (r.flag_reason || '').toLowerCase().includes('location') ||
    (r.flag_reason || '').toLowerCase().includes('geofence') ||
    (r.flag_reason || '').toLowerCase().includes('distance') ||
    (r.distance_m && r.distance_m > 150)
  );

  const displayedReviews = activeFilter === 'face'
    ? faceMismatchReviews
    : activeFilter === 'location'
    ? locationReviews
    : reviews;

  return (
    <div className="space-y-4 pb-20">
      {/* Sticky Top App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md py-2.5 -mx-3.5 px-3.5 border-b border-slate-200/60 select-none flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 -ml-1 text-slate-600 hover:text-slate-900 active:scale-[0.97] transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-base font-extrabold text-[#111827] tracking-tight">
              Pending Review ({reviews.length})
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchReviews}
          disabled={loading}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 active:scale-[0.97] transition shadow-xs"
          title="Refresh Queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          All ({reviews.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('face')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'face'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          Face Mismatch ({faceMismatchReviews.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('location')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeFilter === 'location'
              ? 'bg-[#1A4731] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200/80'
          }`}
        >
          Location ({locationReviews.length})
        </button>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-32 h-3.5 bg-slate-200 rounded" />
                  <div className="w-24 h-2.5 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="w-full h-8 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : displayedReviews.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-xs font-extrabold text-slate-800">No Pending Approvals</h3>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            All student attendance verifications have been processed and approved.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedReviews.map((review) => {
            const isProcessing = actionLoading === review.id;
            const flag = review.flag_reason || 'Biometric confidence below institutional threshold';
            const isLocationIssue = (review.distance_m && review.distance_m > 150) || flag.toLowerCase().includes('location');

            return (
              <div
                key={review.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#1A4731]/10 text-[#1A4731] font-black text-sm flex items-center justify-center ring-1 ring-[#1A4731]/20">
                      {(review.student_name || 'S').charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-[#111827]">
                        {review.student_name || 'Student Name'}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {review.roll_no} &bull; {review.section ? `CSE ${review.section}` : 'CSE 5A'}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {review.timestamp ? new Date(review.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:02 AM'}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    isLocationIssue
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {isLocationIssue ? 'Location anomaly' : 'Face mismatch'}
                  </span>
                </div>

                {/* Audit Explanation Banner */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                    {isLocationIssue ? (
                      <MapPin className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Camera className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">
                      {flag}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {review.subject ? `${review.subject} Session` : 'Live Class Session'}
                      {review.distance_m ? ` • ${Math.round(review.distance_m)}m away` : ''}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: View, Approve, Reject */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedReviewModal(review)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAction(review, 'APPROVE')}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleAction(review, 'REJECT')}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Details Bottom Sheet */}
      <Modal
        isOpen={Boolean(selectedReviewModal)}
        onClose={() => setSelectedReviewModal(null)}
        title="Verification Details"
        subtitle="Review security exception flagged by anti-proxy engine"
        variant="sheet"
      >
        {selectedReviewModal && (
          <div className="space-y-4">
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-bold text-slate-800">{selectedReviewModal.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Roll Number:</span>
                  <span className="font-bold text-slate-800">{selectedReviewModal.roll_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Session ID:</span>
                  <span className="font-bold text-slate-800 font-mono text-[11px]">{selectedReviewModal.session_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Security Issue:</span>
                  <span className="font-bold text-red-600">{selectedReviewModal.flag_reason || 'Low face match score'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Administrative Reason / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Identity verified via student physical ID card"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A4731]/30"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleAction(selectedReviewModal, 'REJECT')}
                className="flex-1 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs active:scale-[0.98] transition"
              >
                Reject Record
              </button>
              <button
                type="button"
                onClick={() => handleAction(selectedReviewModal, 'APPROVE')}
                className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#143826] text-white font-bold text-xs active:scale-[0.98] transition shadow-xs"
              >
                Approve Attendance
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
