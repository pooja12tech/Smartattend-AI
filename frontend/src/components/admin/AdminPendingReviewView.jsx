import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  Search, Eye, Filter, RefreshCw, Check, X, MapPin, Camera
} from 'lucide-react';
import { api } from '../../api';

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
    setActionLoading(review.id);
    try {
      await api.facultyApprove({
        session_id: review.session_id,
        roll_no: review.roll_no,
        action: action, // 'APPROVED' or 'REJECTED'
        remarks: remarks || `Administrative review decision: ${action}`
      });
      // Remove from local list
      setReviews(prev => prev.filter(r => r.id !== review.id));
      setSelectedReviewModal(null);
      setRemarks('');
      if (onStudentReviewed) onStudentReviewed();
    } catch (err) {
      alert(`Review action failed: ${err.message}`);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-slate-600 hover:text-slate-900"
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
          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition"
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
        <div className="py-16 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#1A4731]" />
          Checking pending verification queue...
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

      {/* Review Details Modal */}
      {selectedReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Verification Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReviewModal(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-800">{selectedReviewModal.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Roll Number:</span>
                  <span className="font-bold text-slate-800">{selectedReviewModal.roll_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Session ID:</span>
                  <span className="font-bold text-slate-800">{selectedReviewModal.session_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Security Issue:</span>
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
                className="flex-1 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs"
              >
                Reject Record
              </button>
              <button
                type="button"
                onClick={() => handleAction(selectedReviewModal, 'APPROVE')}
                className="flex-1 py-2.5 rounded-xl bg-[#1A4731] hover:bg-[#1A4731]/90 text-white font-bold text-xs"
              >
                Approve Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
