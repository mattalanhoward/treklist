// src/pages/GearListsOverview.jsx
import React, { useState, useRef } from "react";
import { FiPlus, FiInfo, FiShare2, FiCheckSquare, FiImage, FiX, FiCheck, FiUpload } from "react-icons/fi";
import { BsBackpack4 } from "react-icons/bs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { cldTransformUrl } from "../utils/cloudinary";
import { formatWeight } from "../utils/weight";
import { useUnit } from "../hooks/useUnit";
import { GEARLIST_SWATCHES } from "../config/colors";
import { defaultBackgrounds } from "../config/defaultBackgrounds";
import api from "../services/api";
import { downscaleToTargetBytes } from "../utils/imageProcessing";
import { uploadBackgroundToCloudinary } from "../services/cloudinaryUpload";
import GearListDetailsModal from "../components/GearListDetailsModal";
import CreateListModal from "../components/CreateListModal";
import ShareModal from "../components/ShareModal";

const CARD_BG_TRANSFORM = "f_auto,q_auto,w_400,c_fill";

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

function BackgroundPicker({ list, onClose, onUpdated }) {
  const { t } = useTranslation("common");
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState(null); // null = idle, 0-100 = uploading
  const fileRef = useRef(null);

  const patch = async (payload) => {
    setSaving(true);
    try {
      await api.patch(`/dashboard/${list._id}/preferences`, payload);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(t("gearList.toasts.backgroundUpdateFailed"));
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(t("gearList.toasts.imageTooLarge"));
      e.target.value = "";
      return;
    }
    setSaving(true);
    setUploadPct(0);
    try {
      const { blob, mime } = await downscaleToTargetBytes(file, {
        maxSize: 3000,
        quality: 0.78,
        maxBytes: 1_500_000,
      });
      const ext = mime === "image/webp" ? "webp" : "jpg";
      const { secureUrl, publicId } = await uploadBackgroundToCloudinary({
        blob,
        filename: `bg-${Date.now()}.${ext}`,
        onProgress: setUploadPct,
      });
      await api.patch(`/dashboard/${list._id}/preferences/image-direct`, {
        imageUrl: secureUrl,
        publicId,
      });
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || t("gearList.toasts.imageUploadFailed"));
      setSaving(false);
      setUploadPct(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl shadow-xl p-4 w-[340px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-primary text-sm">{t("gearList.menu.background")}</h3>
          <button type="button" onClick={onClose} className="text-primaryAlt hover:text-primary">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Color swatches */}
        <p className="text-xs text-primaryAlt mb-2">{t("gearList.menu.colors")}</p>
        <div className="grid grid-cols-8 gap-2 mb-4">
          {GEARLIST_SWATCHES.map(({ key, value, class: cls }) => (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => patch({ backgroundColor: value })}
              className={`${cls} w-8 h-8 rounded-full flex items-center justify-center`}
              title={key}
            >
              {list.backgroundColor === value && <FiCheck className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
        </div>

        {/* Background images */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {defaultBackgrounds.map(({ key, label, url }) => (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => patch({ backgroundImageUrl: url })}
              className={`rounded-lg overflow-hidden h-16 ring-offset-1 ${list.backgroundImageUrl === url ? "ring-2 ring-primary" : ""}`}
              title={label}
            >
              <img src={url} alt={label} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Custom upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
        {uploadPct !== null ? (
          <div className="w-full bg-primary/10 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 text-sm text-primaryAlt hover:text-primary border border-dashed border-primary/30 hover:border-primary/60 rounded-lg py-2 transition-colors"
          >
            <FiUpload className="w-4 h-4" />
            {t("gearList.menu.customImage")}
          </button>
        )}
      </div>
    </div>
  );
}

function ListCard({ list, onSelectList, onOpenDetails, onShare, onChecklist, onOpenPicker }) {
  const unit = useUnit();
  const { t } = useTranslation("common");

  const bgImage = list.backgroundImageUrl
    ? cldTransformUrl(list.backgroundImageUrl, CARD_BG_TRANSFORM) || list.backgroundImageUrl
    : "";
  const bgColor = list.backgroundColor || "";

  const cardStyle = bgImage
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : bgColor
      ? { backgroundColor: bgColor }
      : {};

  const textClass = bgImage || bgColor ? "text-white" : "text-primary";
  const subTextClass = bgImage || bgColor ? "text-white/80" : "text-primaryAlt";

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer h-48 sm:h-56 lg:h-80 flex flex-col justify-end transition-transform hover:scale-[1.02] active:scale-[0.98] bg-neutral/60 border border-base-100"
      style={cardStyle}
      onClick={() => onSelectList(list._id)}
    >
      {/* Action buttons — top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenPicker(list); }}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors"
          title={t("gearList.menu.background")}
        >
          <FiImage className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onShare(list); }}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors"
          title={t("gearList.menu.shareList")}
        >
          <FiShare2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChecklist(list._id); }}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors"
          title={t("listsOverview.checklist")}
        >
          <FiCheckSquare className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenDetails(list); }}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors"
          title={t("listsOverview.details")}
        >
          <FiInfo className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content overlay */}
      <div className="p-3 flex flex-col gap-1">
        <h3 className={`font-semibold text-sm leading-tight line-clamp-2 ${textClass}`}>
          {list.title}
        </h3>

        <div className={`flex items-center gap-3 text-xs ${subTextClass}`}>
          <span>{t("listsOverview.itemCount", { count: list.itemCount ?? 0 })}</span>
          {list.baseWeight > 0 && (
            <span className="flex items-center gap-1">
              <BsBackpack4 className="w-3 h-3 flex-shrink-0" />
              {formatWeight(list.baseWeight, unit)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GearListsOverview({ lists, onSelectList, fetchLists, collapsed }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [detailsList, setDetaisList] = useState(null);
  const [shareList, setShareList] = useState(null);
  const [pickerList, setPickerList] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleChecklist = (listId) => {
    navigate(`/dashboard/${listId}/checklist`);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-primary/10 bg-base-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary whitespace-nowrap">
          {t("listsOverview.title")}
        </h2>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          aria-label={t("listsOverview.newList")}
          className="p-1 text-primaryAlt hover:text-primaryAlt/80 transition-colors"
        >
          <FiPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {lists.length === 0 ? (
          <div className="h-full flex items-center justify-center text-primaryAlt text-sm">
            {t("listsOverview.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => (
              <ListCard
                key={list._id}
                list={list}
                onSelectList={onSelectList}
                onOpenDetails={setDetaisList}
                onShare={setShareList}
                onChecklist={handleChecklist}
                onOpenPicker={setPickerList}
              />
            ))}
          </div>
        )}
      </div>

      {/* Background picker */}
      {pickerList && (
        <BackgroundPicker
          list={pickerList}
          onClose={() => setPickerList(null)}
          onUpdated={fetchLists}
        />
      )}

      {/* Details modal */}
      {detailsList && (
        <GearListDetailsModal
          isOpen={!!detailsList}
          onClose={() => setDetaisList(null)}
          list={detailsList}
          itemsCount={detailsList.itemCount ?? 0}
          breakdowns={null}
          totalCost={null}
          onRefresh={fetchLists}
          onRefreshSidebar={fetchLists}
        />
      )}

      {/* Share modal */}
      {shareList && (
        <ShareModal
          listId={shareList._id}
          isOpen={!!shareList}
          onClose={() => setShareList(null)}
        />
      )}

      {/* Create list modal */}
      {showCreateModal && (
        <CreateListModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            fetchLists();
            localStorage.setItem("lastListId", id);
            onSelectList(id);
          }}
        />
      )}
    </div>
  );
}
