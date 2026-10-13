import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import devices from './slices/deviceSlice';
export const store = configureStore({ reducer: { devices }, middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false }) });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
