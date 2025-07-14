-- Clear all data from orbit v2 tables
-- Delete in order to respect foreign key relationships

-- Delete from images first (references orders)
DELETE FROM public.images;

-- Delete from payments (references orders)
DELETE FROM public.payments;

-- Delete from orders
DELETE FROM public.orders;