/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * The format for each error message is:
 *
 * MSG_DEF(<SYMBOLIC_NAME>, <ARGUMENT_COUNT>, <FORMAT_STRING>)
 *
 * where
 *
 * <SYMBOLIC_NAME> is a legal C++ identifer that will be used in the source.
 *
 * <ARGUMENT_COUNT> is an integer literal specifying the total number of
 * replaceable arguments in the following format string.
 *
 * <FORMAT_STRING> is a string literal, containing <ARGUMENT_COUNT> sequences
 * {X} where X  is an integer representing the argument number that will
 * be replaced with a string value when the error is reported.
 */

MSG_DEF(MSG_INVALID_ENUM_VALUE, 2, "Value '{0}' is not a valid value for enumeration {1}.")
MSG_DEF(MSG_MISSING_ARGUMENTS, 1, "Not enough arguments to {0}.")
MSG_DEF(MSG_NOT_OBJECT, 0, "Value not an object.")
MSG_DEF(MSG_NOT_CALLABLE, 0, "Value is not callable.")
MSG_DEF(MSG_DOES_NOT_IMPLEMENT_INTERFACE, 1, "Value does not implement interface {0}.")
MSG_DEF(MSG_NOT_IN_UNION, 1, "Value could not be converted to any of: {0}.")
MSG_DEF(MSG_ILLEGAL_CONSTRUCTOR, 0, "Illegal constructor.")
MSG_DEF(MSG_NO_PROPERTY_SETTER, 1, "{0} doesn't have an indexed property setter.")
MSG_DEF(MSG_ENFORCE_RANGE_NON_FINITE, 1, "Non-finite value is out of range for {0}.")
MSG_DEF(MSG_ENFORCE_RANGE_OUT_OF_RANGE, 1, "Value is out of range for {0}.")
MSG_DEF(MSG_NOT_SEQUENCE, 0, "object can not be converted to a sequence")
MSG_DEF(MSG_NOT_DICTIONARY, 0, "value can not be converted to a dictionary")
MSG_DEF(MSG_INVALID_ARG, 2, "argument {0} is not valid for any of the {1}-argument overloads")
MSG_DEF(MSG_GLOBAL_NOT_NATIVE, 0, "global is not a native object")
MSG_DEF(MSG_ENCODING_NOT_SUPPORTED, 1, "The given encoding '{0}' is not supported.")
MSG_DEF(MSG_DOM_ENCODING_NOT_UTF, 0, "The encoding must be utf-8, utf-16, or utf-16be.")
MSG_DEF(MSG_NOT_FINITE, 0, "Floating-point value is not finite.")
MSG_DEF(MSG_INVALID_VERSION, 0, "0 (Zero) is not a valid database version.")
