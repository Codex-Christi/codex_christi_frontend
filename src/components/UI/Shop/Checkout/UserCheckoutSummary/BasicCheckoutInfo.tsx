"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/UI/primitives/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/UI/primitives/form";
import { CountryDropdown } from "@/components/UI/primitives/country-dropdown";
import { SignUpFormSchema } from "@/lib/formSchemas/signUpFormSchema";
import { EmailInput, NameInput } from "@/components/UI/Auth/FormFields";
import { FaAngleDoubleDown } from "react-icons/fa";
import { useShopCheckoutStore } from "@/stores/shop_stores/checkoutStore";
import { useContext, useMemo } from "react";
import { CheckoutAccordionContext } from "../ProductCheckout";
import { billingAddressSchema } from "@/lib/formSchemas/shop/paypal-order/billingAddressSchema";
import { DeliveryAddressInputFields } from "./DeliveryAddressInputFields";
import errorToast from "@/lib/error-toast";

const signupExtSchema = SignUpFormSchema.pick({
  firstname: true,
  lastname: true,
  email: true,
});
const deliveryAddressSchema = billingAddressSchema.pick({
  addressLine1: true,
  addressLine2: true,
  adminArea1: true,
  adminArea2: true,
  postalCode: true,
});

const BasicCheckoutInfoFormSchema = z
  .object({
    country: z.string({
      required_error: "Please select a country",
    }),
  })
  .merge(signupExtSchema)
  .merge(deliveryAddressSchema);

export type BasicCheckoutInfoFormSchema = z.infer<typeof BasicCheckoutInfoFormSchema>;

// Main Form Component Starts Here
export const BasicCheckoutInfo = () => {
  // Hooks
  const { handleOpenItem } = useContext(CheckoutAccordionContext);

  const { delivery_address, first_name, last_name, email } = useShopCheckoutStore((state) => state);

  const {
    shipping_address_line_1,
    shipping_address_line_2,
    shipping_city,
    shipping_country,
    shipping_state,
    zip_code,
  } = delivery_address || {};

  // Extract Default Values
  const storeValues = useMemo(() => {
    return {
      country: shipping_country ?? undefined,
      firstname: first_name ?? "",
      lastname: last_name ?? "",
      email: email ?? "",
      // Extract addressLine1 from delivery_address
      addressLine1: shipping_address_line_1 ?? "",
      addressLine2: shipping_address_line_2 ?? "",
      adminArea1: shipping_city ?? "",
      adminArea2: shipping_state ?? "",
      postalCode: zip_code ?? "",
    };
  }, [
    email,
    first_name,
    last_name,
    shipping_address_line_1,
    shipping_address_line_2,
    shipping_city,
    shipping_country,
    shipping_state,
    zip_code,
  ]);

  // useForm Hook Starts Here
  const basicCheckoutInfoForm = useForm<z.infer<typeof BasicCheckoutInfoFormSchema>>({
    resolver: zodResolver(BasicCheckoutInfoFormSchema),
    defaultValues: storeValues,
  });

  // Handlers
  function onSubmit(data: z.infer<typeof BasicCheckoutInfoFormSchema>) {
    // Only spread the rest of the data except country
    const {
      country,
      firstname,
      lastname,
      addressLine1,
      addressLine2,
      adminArea1,
      adminArea2,
      postalCode,
      ...rest
    } = data;
    useShopCheckoutStore.setState((state) => ({
      ...state,
      first_name: firstname,
      last_name: lastname,
      delivery_address: {
        ...state.delivery_address,
        shipping_country: country,
        shipping_address_line_1: addressLine1,
        shipping_address_line_2: addressLine2 ?? "",
        shipping_city: adminArea2,
        shipping_state: adminArea1,
        zip_code: postalCode,
      },
      ...rest,
    }));
    // Move Accordion to Delivery Details
    handleOpenItem("payment-section");
  }

  // Main JSX
  return (
    <>
      <h2 className="border-b max-w-fit mb-10 border-white pb-1 text-xl font-bold">
        Contact and Delivery Information
      </h2>
      <Form {...basicCheckoutInfoForm}>
        <form
          onSubmit={basicCheckoutInfoForm.handleSubmit(onSubmit, (errors) => {
            errorToast({
              message: "Check form and correct errors",
              header: "Incorrect details!",
            });
            console.log(errors);
          })}
          className="w-full  grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-3 items-center"
        >
          {/* First Name Input*/}
          <NameInput currentZodForm={basicCheckoutInfoForm} inputName="firstname" />

          {/* Last Name Input*/}
          <NameInput currentZodForm={basicCheckoutInfoForm} inputName="lastname" />

          {/* Email Input */}
          <EmailInput currentZodForm={basicCheckoutInfoForm} inputName="email" />

          {/* Dleivery Address Input Fields */}
          <DeliveryAddressInputFields currentZodForm={basicCheckoutInfoForm} />

          {/* Country Input */}
          <FormField
            control={basicCheckoutInfoForm.control}
            name="country"
            render={({ field }) => (
              <FormItem className="self-baseline">
                <FormLabel>Country</FormLabel>
                <CountryDropdown
                  placeholder="Country"
                  defaultValue={field.value}
                  onChange={(country) => {
                    field.onChange(country.alpha3);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {/*  */}

          {/* Submit Checkout Summary */}
          <Button
            name="Checkout Summary Submit"
            type="submit"
            className=" col-span-1 md:col-span-2 w-full max-w-[400px] mt-5 mx-auto rounded-3xl
            !font-bold px-4 sm:px-6 py-2 sm:py-3 text-lg sm:text-base
            bg-stone-500 hover:bg-stone-100 hover:bg-opacity-10 bg-opacity-10 
            backdrop-blur-md shadow-md shadow-gray-400 flex gap-6"
            // border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 hover:text-white
          >
            <h4>Choose Payment Method</h4>
            <FaAngleDoubleDown size={22.5} />
            <style jsx>
              {`
                h4 {
                  word-spacing: 0.25rem;
                }
              `}
            </style>
          </Button>
        </form>
      </Form>
    </>
  );
};
