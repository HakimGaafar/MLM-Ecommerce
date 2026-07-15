import type ar from "@/i8n/ar.json";
import type en from "@/i8n/en.json";

type VendorProductsDict = typeof en.vendorProducts;

export function vendorProductFormUi(dict: VendorProductsDict, mode: "create" | "edit") {
  return {
    name: dict.formName,
    price: dict.formPrice,
    currency: dict.formCurrency,
    category: dict.formCategory,
    categoryPlaceholder: dict.formCategoryPlaceholder,
    images: dict.formImages,
    imagesHint: dict.formImagesHint,
    imageUrl: dict.formImageUrl,
    addImage: dict.formAddImage,
    uploadImage: dict.formUploadImage,
    uploadImages: dict.formUploadImages,
    uploading: dict.formUploading,
    removeImage: dict.formRemoveImage,
    setCover: dict.formSetCover,
    coverBadge: dict.formCoverBadge,
    seoSection: dict.formSeoSection,
    metaTitle: dict.formMetaTitle,
    metaTitleHint: dict.formMetaTitleHint,
    metaDescription: dict.formMetaDescription,
    metaDescriptionHint: dict.formMetaDescriptionHint,
    formFulfillment: dict.formFulfillment,
    formFulfillmentHint: dict.formFulfillmentHint,
    formFulfillmentDirect: dict.formFulfillmentDirect,
    formFulfillmentWarehouseA: dict.formFulfillmentWarehouseA,
    formFulfillmentWarehouseB: dict.formFulfillmentWarehouseB,
    submit: mode === "create" ? dict.formSubmitCreate : dict.formSubmitUpdate,
    submitting: dict.formSubmitting,
    loadingProduct: dict.loadingProduct,
    loadError: dict.loadError,
    saveError: dict.saveError,
    editPendingNote: dict.editPendingNote,
    editRejectedReasonLabel: dict.editRejectedReasonLabel,
    productRejectedReasonLabel: dict.productRejectedReasonLabel,
  };
}
